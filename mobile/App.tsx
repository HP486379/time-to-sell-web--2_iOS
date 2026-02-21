import { useEffect } from 'react'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useColorScheme } from 'react-native'
import * as Notifications from 'expo-notifications'

import { DashboardScreen } from './src/screens/DashboardScreen'
import { getExpoPushToken } from './src/push/getExpoPushToken'
import { registerPushToken } from './src/push/registerPush'

const Tab = createBottomTabNavigator()

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

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
        await registerPushToken(token)
      } catch (err) {
        console.log('[push] 初期化エラー', err)
      }
    }
    run()
  }, [])

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Tab.Navigator>
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
