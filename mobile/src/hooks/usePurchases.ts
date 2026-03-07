// mobile/src/hooks/usePurchases.ts
import { useEffect, useMemo, useState, useCallback } from "react";
import Purchases, { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

type RevenueCatConfig = {
  iosApiKey: string;
  entitlementId: string; // e.g. "nikkei_unlock"
};

const STORAGE_KEYS = {
  appUserId: "tts_user_id",
};

function getRevenueCatConfig(): RevenueCatConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as any;
  const rc = extra.revenuecat ?? {};

  // app.json に入れてない場合はここで落とす（気づけるように）
  if (!rc.iosApiKey) throw new Error("RevenueCat iosApiKey is missing in app.json (expo.extra.revenuecat.iosApiKey)");
  if (!rc.entitlementId) throw new Error("RevenueCat entitlementId is missing in app.json (expo.extra.revenuecat.entitlementId)");

  return {
    iosApiKey: rc.iosApiKey,
    entitlementId: rc.entitlementId,
  };
}

async function getOrCreateAppUserId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.appUserId);
  if (existing) return existing;

  // ランダムID生成（UUIDライブラリ無しで十分）
  const newId = `tts_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  await AsyncStorage.setItem(STORAGE_KEYS.appUserId, newId);
  return newId;
}

function hasEntitlement(info: CustomerInfo | null, entitlementId: string): boolean {
  const active = info?.entitlements?.active ?? {};
  return Boolean(active[entitlementId]);
}

export function usePurchases() {
  const [{ iosApiKey, entitlementId }] = useState(() => getRevenueCatConfig());

  const [isReady, setIsReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isUnlocked = useMemo(() => hasEntitlement(customerInfo, entitlementId), [customerInfo, entitlementId]);

  const refresh = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const appUserId = await getOrCreateAppUserId();

        // ここが「RevenueCat API Key」を入れる場所
        await Purchases.configure({ apiKey: iosApiKey, appUserID: appUserId });

        // CustomerInfo更新イベント
        const listener = Purchases.addCustomerInfoUpdateListener((info) => {
          if (!mounted) return;
          setCustomerInfo(info);
        });

        await refresh();

        if (!mounted) return;
        setIsReady(true);
        setError(null);

        return () => {
          listener?.remove?.();
        };
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? String(e));
        setIsReady(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [iosApiKey, refresh]);

  const purchase = useCallback(async () => {
    try {
      setError(null);

      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current) throw new Error("RevenueCat offerings.current is null (Offering未設定の可能性)");

      // まずは current の最初のパッケージを買う（Lifetime 1個運用ならこれでOK）
      const pkg: PurchasesPackage | undefined =
        current.availablePackages?.[0] ?? current.lifetime ?? current.annual ?? current.monthly;

      if (!pkg) throw new Error("No purchasable package found in current offering");

      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return info;
    } catch (e: any) {
      // ユーザーキャンセルはエラー扱いにしない
      if (e?.userCancelled) return null;
      setError(e?.message ?? String(e));
      throw e;
    }
  }, []);

  const restore = useCallback(async () => {
    try {
      setError(null);
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info;
    } catch (e: any) {
      setError(e?.message ?? String(e));
      throw e;
    }
  }, []);

  return {
    isReady,
    isUnlocked,
    customerInfo,
    error,
    purchase,
    restore,
    refresh,
  };
}