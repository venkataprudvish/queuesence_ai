/**
 * Strict QueueSense Color & Design Token System
 * Warm Ivory + Forest Green + Muted Sage Light Identity
 */
export const QS_COLORS = {
  bgPrimary: '#F7F5EC',      // Warm Ivory
  brandPrimary: '#244C3A',   // Forest Green
  secondarySage: '#A8B9A0',  // Muted Sage
  cardCream: '#FFFDF6',      // Soft Cream
  textPrimary: '#252B26',    // Deep Charcoal
  textSecondary: '#777D75',  // Muted Grey
  borderSage: '#E1E6DA',     // Soft Sage
  successGreen: '#477A55',   // Natural Green
  warningAmber: '#D49A45',   // Warm Amber
  errorTerracotta: '#C66B5B' // Muted Terracotta
} as const;

export const DEFAULT_QUEUE_REGION = {
  id: 'default-roi-lane',
  name: 'Primary Service Lane',
  points: [
    { x: 0.18, y: 0.24 },
    { x: 0.82, y: 0.24 },
    { x: 0.88, y: 0.86 },
    { x: 0.12, y: 0.86 },
  ],
  entryEdgeIndex: 2, // Bottom edge
  exitEdgeIndex: 0,  // Top edge (service counter)
};
