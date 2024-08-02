import redis from 'redis';
import { promisify } from 'util';

const client = redis.createClient();
const setAsync = promisify(client.set).bind(client);
const getAsync = promisify(client.get).bind(client);
const delAsync = promisify(client.del).bind(client);

async function debounceUpdate(warehouseId: string, inventoryId: string, stock: number, callback: Function) {
  const key = `debounce:${warehouseId}:${inventoryId}`;
  const previousUpdate = await getAsync(key);

  if (previousUpdate) {
    clearTimeout(parseInt(previousUpdate));
  }

  const timeout = setTimeout(async () => {
    await callback(warehouseId, inventoryId, stock);
    await delAsync(key);
  }, 1000); // 1 second debounce time

  await setAsync(key, timeout.toString());
}

export { debounceUpdate };