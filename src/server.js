// src/server.js
import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Portal backend corriendo en http://localhost:${PORT}`);
  console.log(`   Manager API: ${process.env.MANAGER_API_URL}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
});
