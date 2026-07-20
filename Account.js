const mongoose = require('mongoose');

// Mismo esquema que usa microservice-banking-git, para operar sobre las
// MISMAS cuentas (comparten la base de datos "banking", coleccion "accounts").
const accountSchema = new mongoose.Schema({
    accountNumber: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    balance: { type: Number, required: true, default: 0 },
});

module.exports = mongoose.model('Account', accountSchema);
