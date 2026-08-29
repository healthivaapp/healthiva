import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a6f8a" />
      <View style={styles.header}>
        <Text style={styles.logoText}>🩺 Healthiva Doctor</Text>
        <Text style={styles.subText}>OPD Consultation & Quick RX Assistant</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>👨‍⚕️ Doctor OPD Workflow</Text>
        <Text style={styles.cardBody}>
          View live patient queue, access past medical history, enter quick notes, and generate prescription slips.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Day 1 Mobile Setup Complete</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
  },
});
