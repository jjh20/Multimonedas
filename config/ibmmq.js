// Reemplaza el modulo de RabbitMQ. Publica eventos hacia IBM MQ usando
// su API REST de mensajeria (mqweb), en vez de un cliente AMQP nativo.
//
// Mismo diseno que en microservice-banking-git: el "routingKey" se
// guarda DENTRO del propio mensaje JSON (IBM MQ no tiene el concepto de
// "exchange"/"routing key" de RabbitMQ a nivel de broker).

const IBM_MQ_REST_URL = process.env.IBM_MQ_REST_URL || 'https://ibm-mq-qa:9443';
const IBM_MQ_QMGR = process.env.IBM_MQ_QMGR || 'QM1';
const IBM_MQ_QUEUE = process.env.IBM_MQ_QUEUE || 'DEV.QUEUE.1';
const IBM_MQ_USUARIO = process.env.IBM_MQ_USUARIO || 'app';
const IBM_MQ_PASSWORD = process.env.IBM_MQ_PASSWORD || 'passw0rd123';

// Certificado autofirmado de la instalacion de desarrollo de IBM MQ.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let conectado = false;

function _authHeader() {
    const auth = Buffer.from(`${IBM_MQ_USUARIO}:${IBM_MQ_PASSWORD}`).toString('base64');
    return `Basic ${auth}`;
}

async function connectIBMMQ() {
    const respuesta = await fetch(`${IBM_MQ_REST_URL}/ibmmq/rest/v2/admin/installation`, {
        headers: { Authorization: _authHeader() },
    });
    if (respuesta.status >= 500) {
        throw new Error(`[IBM MQ] mqweb no responde (status ${respuesta.status})`);
    }
    conectado = true;
    console.log('[IBM MQ] Connected -- servidor mqweb responde en', IBM_MQ_REST_URL);
}

async function publishEvent(routingKey, payload) {
    if (!conectado) {
        throw new Error('[IBM MQ] No conectado, no se pudo publicar el evento');
    }

    const mensaje = JSON.stringify({ ...payload, routingKey, timestamp: new Date().toISOString() });
    const url = `${IBM_MQ_REST_URL}/ibmmq/rest/v2/messaging/qmgr/${IBM_MQ_QMGR}/queue/${IBM_MQ_QUEUE}/message`;

    const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: _authHeader(),
            'Content-Type': 'text/plain;charset=utf-8',
            'ibm-mq-rest-csrf-token': 'app-microservicio',
        },
        body: mensaje,
    });

    if (!respuesta.ok) {
        throw new Error(`[IBM MQ] No se pudo publicar el evento '${routingKey}' -- status ${respuesta.status}`);
    }
}

module.exports = {
    connectIBMMQ,
    connectIbmMQ: connectIBMMQ, // alias -- por si el codigo que lo importa usa esta variante de mayusculas
    publishEvent,
};