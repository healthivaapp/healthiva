import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';
import type { UserRole } from '@healthiva/types';

export default function App() {
  const doctorRole: UserRole = 'doctor';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.logoText}>🩺 Healthiva Doctor</Text>
        <Text style={styles.subText}>OPD Consultation & Quick RX Assistant</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>👨‍⚕️ Doctor Mobile Workflow</Text>
        <Text style={styles.cardBody}>
          Official Expo App Shell ready. Connects to shared monorepo packages for types and Supabase.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Active Role: {doctorRole}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f7fa',
  },
  header: {
    backgroundColor: '#1a6f8a',
    padding: 24,
    paddingTop: 48,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  logoText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
  badge: {
    backgroundColor: '#e6fffa',
    borderColor: '#319795',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#234e52',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
