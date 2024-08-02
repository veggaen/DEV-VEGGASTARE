import { NextApiRequest, NextApiResponse } from 'next';
import Pusher from 'pusher';

const LOG_PREFIX = '[frontend/app/api/pusher/route.ts]';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(LOG_PREFIX, 'Received request:', req.method, req.body);

  if (req.method === 'POST') {
    const { channel, event, data } = req.body;

    try {
      console.log(LOG_PREFIX, 'Triggering event:', event, 'on channel:', channel, 'with data:', data);
      await pusher.trigger(channel, event, data);
      console.log(LOG_PREFIX, 'Event triggered successfully');
      res.status(200).json({ message: 'Event triggered successfully' });
    } catch (error) {
      console.error(LOG_PREFIX, 'Error triggering event:', error);
      res.status(500).json({ error: 'Error triggering event' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}