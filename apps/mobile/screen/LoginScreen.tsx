import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function LoginScreen() {
  return (
    <SafeAreaView>
      <View style={styleSheet.maincontainer}>
        <Text>LoginScreen</Text>
      </View>
    </SafeAreaView>
  )
}

const styleSheet =  StyleSheet.create({
maincontainer :{
    flex :1,
    justifyContent:'center',
    alignItems:"center",
    backgroundColor:"#000000"
}
})