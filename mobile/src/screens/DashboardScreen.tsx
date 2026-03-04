// Updated code for DashboardScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DashboardScreen = () => {
    return (
        <View style={styles.container}>
            <Text>Dashboard</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        // Viewport settings for small screens
        paddingHorizontal: '5%',
        paddingVertical: '5%',
    },
});

export default DashboardScreen;