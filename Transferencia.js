const mongoose = require('mongoose');

const transferenciaSchema = new mongoose.Schema({
    cuentaOrigen: { type: String, required: true },
    cuentaDestino: { type: String, required: true },
    montoOrigen: { type: Number, required: true },
    montoDestino: { type: Number, required: true },
    monedaOrigen: { type: String, required: true, enum: ['DOP', 'USD'] },
    monedaDestino: { type: String, required: true, enum: ['DOP', 'USD'] },
    tasaCambioAplicada: { type: Number, required: true },
    estado: { type: String, required: true, enum: ['completada', 'rechazada'], default: 'completada' },
    motivoRechazo: { type: String },
    fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transferencia', transferenciaSchema);
