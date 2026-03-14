// mobile/src/hooks/usePurchases.ts
import { useEffect, useMemo, useState, useCallback } from "react";
import Purchases, { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import Constants from "expo-constants";

type RevenueCatConfig = {
  iosApiKey: string;
  entitlementId: string; // e.g. "nikkei_unlock"
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
        // RevenueCat の configure は revenuecat.ts 側で一元管理する

        // CustomerInfo更新イベント
        const listener = Purchases.addCustomerInfoUpdateListener((info) => {
          if (!mounted) return;
          setCustomerInfo(info);
        });

        await refresh();

        if (!mounted) return;
        setIsReady(true);
        setError(null);

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
