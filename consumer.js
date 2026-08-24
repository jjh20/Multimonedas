// consumer.js -- Consumidor de multimoneda. Escucha DEV.QUEUE.2 (una
// cola DISTINTA a la que usa banking-git para su propio consumo interno,
// DEV.QUEUE.1) -- asi cada microservicio recibe su copia correspondiente
// sin competir por el mismo mensaje.
//
// Reaccion simbolica para la demo: cuando se crea una cuenta nueva,
// registra el evento (en un caso real, aqui podria pre-cachear la tasa
// de cambio para esa cuenta, o cualquier otra logica de negocio propia
// de multimoneda relacionada a cuentas nuevas).

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const IBM_MQ_REST_URL = process.env.IBM_MQ_REST_URL || 'https://ibm-mq-qa:9443';
const IBM_MQ_QMGR = process.env.IBM_MQ_QMGR || 'QM1';
const IBM_MQ_QUEUE_ESCUCHA = process.env.IBM_MQ_QUEUE_MULTIMONEDA || 'DEV.QUEUE.2';
const IBM_MQ_USUARIO = process.env.IBM_MQ_USUARIO || 'app';
const IBM_MQ_PASSWORD = process.env.IBM_MQ_PASSWORD || 'passw0rd123';
const WAIT_MS = 5000;

function _authHeader() {
  const auth = Buffer.from(`${IBM_MQ_USUARIO}:${IBM_MQ_PASSWORD}`).toString('base64');
  return `Basic ${auth}`;
}

async function consumirUnMensaje() {
  const url = `${IBM_MQ_REST_URL}/ibmmq/rest/v2/messaging/qmgr/${IBM_MQ_QMGR}/queue/${IBM_MQ_QUEUE_ESCUCHA}/message?wait=${WAIT_MS}`;

  const respuesta = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: _authHeader(),
      Accept: 'text/plain',
      'ibm-mq-rest-csrf-token': 'app-microservicio',
    },
  });

  if (respuesta.status === 200) {
    const texto = await respuesta.text();
    const evento = JSON.parse(texto);
    console.log(`[Multimoneda Consumer] Evento recibido [${evento.routingKey}]:`, evento);
    if (evento.routingKey === 'transaction.cuenta') {
      console.log(`[Multimoneda Consumer] Cuenta nueva detectada (${evento.accountNumber}) -- preparando tasas de cambio para esta cuenta.`);
    }
    return true;
  }
  if (respuesta.status === 404) {
    return false; // cola vacia dentro del tiempo de espera, normal
  }
  console.error('[Multimoneda Consumer] Respuesta inesperada de IBM MQ:', respuesta.status);
  return false;
}

async function startConsumer() {
  console.log(`[Multimoneda Consumer] Listening on queue "${IBM_MQ_QUEUE_ESCUCHA}" via IBM MQ REST (modo polling, wait=${WAIT_MS}ms)`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await consumirUnMensaje();
    } catch (err) {
      console.error('[Multimoneda Consumer] Failed to poll:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

startConsumer().catch((err) => {
  console.error('[Multimoneda Consumer] Failed to start:', err.message);
});

module.exports = { startConsumer };
