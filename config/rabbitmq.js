const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const EXCHANGE_NAME = 'banking.events';

let canal = null;

async function connectRabbitMQ() {
    const conexion = await amqp.connect(RABBITMQ_URL);
    canal = await conexion.createChannel();
    await canal.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    console.log('[RabbitMQ] Connected and exchange asserted:', EXCHANGE_NAME);

    conexion.on('close', () => {
        console.error('[RabbitMQ] Conexion cerrada inesperadamente');
        canal = null;
    });
}

async function publishEvent(routingKey, payload) {
    if (!canal) {
        throw new Error('[RabbitMQ] Canal no disponible, no se pudo publicar el evento');
    }
    canal.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
    });
}

module.exports = { connectRabbitMQ, publishEvent };
