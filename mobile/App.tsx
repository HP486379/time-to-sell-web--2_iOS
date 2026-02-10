import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Text, useColorScheme, View } from 'react-native'

import { DashboardScreen } from './src/screens/DashboardScreen'

const Tab = createBottomTabNavigator()

function BacktestPlaceholder() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>バックテストは次フェーズで実装予定</Text>
    </View>
  )
}

export default function App() {
  const colorScheme = useColorScheme()

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Tab.Navigator>
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Backtest" component={BacktestPlaceholder} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
