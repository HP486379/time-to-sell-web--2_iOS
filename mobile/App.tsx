import { useEffect } from 'react'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Text, useColorScheme, View } from 'react-native'
import * as Notifications from 'expo-notifications'

import { DashboardScreen } from './src/screens/DashboardScreen'
import { PushDebugScreen } from './src/screens/PushDebugScreen'
import { getExpoPushToken } from './src/push/getExpoPushToken'
import { registerPushToken } from './src/push/registerPush'

const Tab = createBottomTabNavigator()

const linking = {
  prefixes: ['time-to-sell://'],
  config: {
    screens: {
      Dashboard: 'dashboard',
      Backtest: 'backtest',
      'Push Debug': 'push-debug',
    },
  },
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

function BacktestPlaceholder() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>バックテストは次フェーズで実装予定</Text>
    </View>
  )
}

export default function App() {
  const colorScheme = useColorScheme()

  useEffect(() => {
    const run = async () => {
      try {
        const token = await getExpoPushToken()
        if (!token) {
          console.log('[push] token 取得できず（権限拒否または実機以外）')
          return
        }
        console.log('[push] token 取得成功', token)
        await registerPushToken(token)
      } catch (err) {
        console.log('[push] 初期化エラー', err)
      }
    }
    run()
  }, [])

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking} theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Tab.Navigator>
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Backtest" component={BacktestPlaceholder} />
          <Tab.Screen name="Push Debug" component={PushDebugScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
