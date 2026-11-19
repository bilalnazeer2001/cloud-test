// Electrical / plumbing / home-automation point markers.
// Add new kinds here: icon is a short label drawn in the 2D plan, elev is the
// default height above the floor in metres.
export const MARKERS = {
  switch:   { name: 'Switch',        group: 'Electrical', color: '#f2b705', icon: 'S',  elev: 1.2 },
  socket:   { name: 'Socket',        group: 'Electrical', color: '#f28705', icon: '⊙', elev: 0.3 },
  socket_hi:{ name: 'Power socket 16A', group: 'Electrical', color: '#d95204', icon: 'P', elev: 0.3 },
  light_pt: { name: 'Light point',   group: 'Electrical', color: '#ffd84d', icon: 'L',  elev: 2.7 },
  db_box:   { name: 'Distribution board', group: 'Electrical', color: '#8c8c8c', icon: 'DB', elev: 1.6 },
  junction: { name: 'Junction box',  group: 'Electrical', color: '#a6a6a6', icon: 'J',  elev: 2.4 },
  controller:{ name: 'Controller / ESP32', group: 'Automation', color: '#2f9e44', icon: 'µC', elev: 1.4 },
  sensor_pir:{ name: 'Motion sensor', group: 'Automation', color: '#7048e8', icon: 'M', elev: 2.4 },
  sensor_door:{ name: 'Door sensor', group: 'Automation', color: '#9c36b5', icon: 'D', elev: 2.0 },
  sensor_temp:{ name: 'Temp / humidity', group: 'Automation', color: '#1098ad', icon: 'T', elev: 1.5 },
  sensor_level:{ name: 'Water level sensor', group: 'Automation', color: '#1c7ed6', icon: 'W', elev: 0.2 },
  camera:   { name: 'Camera',        group: 'Automation', color: '#343a40', icon: 'C',  elev: 2.6 },
  wifi:     { name: 'Wi-Fi / router',group: 'Automation', color: '#5c7cfa', icon: 'R',  elev: 1.8 },
  pump:     { name: 'Pump',          group: 'Plumbing',   color: '#1971c2', icon: 'Pu', elev: 0.1 },
  valve:    { name: 'Valve',         group: 'Plumbing',   color: '#4dabf7', icon: 'V',  elev: 0.6 },
  tap:      { name: 'Tap / water point', group: 'Plumbing', color: '#74c0fc', icon: 'Tp', elev: 0.9 },
  drain:    { name: 'Drain',         group: 'Plumbing',   color: '#495057', icon: 'Dr', elev: 0.0 },
};
