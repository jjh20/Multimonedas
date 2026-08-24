const { connectIbmMQ, publishEvent } = require('./config/ibmmq');
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

const PUERTO = process.env.PORT || 3000;
// Tasa de cambio ilustrativa para el sandbox -- configurable, NO representa
// una tasa real de mercado.
const TASA_CAMBIO_USD_DOP = parseFloat(process.env.TASA_CAMBIO_USD_DOP || '60.00');

console.log('URI:', process.env.MONGO_URI);
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/bankdb?retryWrites=false')
    .then(() => {
        console.log('MongoDB conectado exitosamente');
        connectIbmMQ().catch(err => {
            console.error('[IbmMQ] Failed to connect, retrying in 5s...', err.message);
            setTimeout(() => connectIbmMQ().catch(e => console.error('[IbmMQ] Reintento fallido:', e.message)), 5000);
        });
        require('./consumer'); // arranca el consumidor de IBM MQ
        app.listen(PUERTO, () => console.log(`Servicio multimoneda corriendo en puerto ${PUERTO}`));
    })
    .catch(err => console.error('Error de conexión:', err));

mongoose.connection.on('disconnected', () => {
    console.error('[Mongo] Desconectado - el servicio esta operando sin base de datos');
});

mongoose.connection.on('reconnected', () => {
    console.log('[Mongo] Reconectado exitosamente - servicio recuperado');
});

// Ruta de prueba
app.get('/test', (req, res) => res.json({ status: 'OK', message: 'Microservicio multimoneda operativo' }));

function convertirMonto(monto, monedaOrigen, monedaDestino) {
    if (monedaOrigen === monedaDestino) {
        return { montoConvertido: monto, tasaAplicada: 1 };
    }
    if (monedaOrigen === 'USD' && monedaDestino === 'DOP') {
        return { montoConvertido: monto * TASA_CAMBIO_USD_DOP, tasaAplicada: TASA_CAMBIO_USD_DOP };
    }
    if (monedaOrigen === 'DOP' && monedaDestino === 'USD') {
        return { montoConvertido: monto / TASA_CAMBIO_USD_DOP, tasaAplicada: TASA_CAMBIO_USD_DOP };
    }
    throw new Error(`Conversion no soportada: ${monedaOrigen} -> ${monedaDestino}`);
}

// 1. Transferencia multimoneda entre cuentas
app.post('/transferencia', async (req, res) => {
    try {
        const { cuentaOrigen, cuentaDestino, monto, monedaOrigen, monedaDestino } = req.body;

        if (typeof cuentaOrigen !== 'string' || typeof cuentaDestino !== 'string') {
            return res.status(400).json({ error: 'Formato de cuenta invalido' });
        }
        const montoNumerico = Number(monto);
        if (isNaN(montoNumerico) || montoNumerico <= 0) {
            return res.status(400).json({ error: 'El monto debe ser un numero valido y mayor a cero' });
        }
        if (!['DOP', 'USD'].includes(monedaOrigen) || !['DOP', 'USD'].includes(monedaDestino)) {
            return res.status(400).json({ error: "Moneda invalida, use 'DOP' o 'USD'" });
        }

        const origen = await Account.findOne({ accountNumber: cuentaOrigen });
        if (!origen) {
            return res.status(404).json({ error: 'Cuenta origen no existe' });
        }
        const destino = await Account.findOne({ accountNumber: cuentaDestino });
        if (!destino) {
            return res.status(404).json({ error: 'Cuenta destino no existe' });
        }

        if (origen.balance < montoNumerico) {
            await Transferencia.create({
                cuentaOrigen, cuentaDestino, montoOrigen: montoNumerico, montoDestino: 0,
                monedaOrigen, monedaDestino, tasaCambioAplicada: 0,
                estado: 'rechazada', motivoRechazo: 'Saldo insuficiente',
            });
            return res.status(400).json({ error: 'Saldo insuficiente en cuenta origen' });
        }

        const { montoConvertido, tasaAplicada } = convertirMonto(montoNumerico, monedaOrigen, monedaDestino);

        origen.balance -= montoNumerico;
        destino.balance += montoConvertido;
        await origen.save();
        await destino.save();

        const transferencia = await Transferencia.create({
            cuentaOrigen, cuentaDestino,
            montoOrigen: montoNumerico, montoDestino: montoConvertido,
            monedaOrigen, monedaDestino, tasaCambioAplicada: tasaAplicada,
            estado: 'completada',
        });

        await publishEvent('transaction.multimoneda', {
            evento: 'TRANSFERENCIA_COMPLETADA',
            transferenciaId: transferencia._id,
            cuentaOrigen, cuentaDestino,
            montoOrigen: montoNumerico, montoDestino: montoConvertido,
            monedaOrigen, monedaDestino,
        });

        res.status(201).json(transferencia);
    } catch (err) {
        console.error('[POST /transferencia] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. Consultar una transferencia especifica
app.get('/transferencia/:id', async (req, res) => {
    try {
        const transferencia = await Transferencia.findById(req.params.id);
        if (!transferencia) {
            return res.status(404).json({ error: 'Transferencia no encontrada' });
        }
        res.json(transferencia);
    } catch (err) {
        console.error('[GET /transferencia] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});
