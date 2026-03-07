const cron = require('node-cron');
const Redis = require('ioredis');
const Trip = require('../models/Trip');

const LOCK_KEY = 'scheduler:trip-reactivation:midnight-lock';
const LOCK_TTL_SECONDS = 600;
const DEFAULT_TIMEZONE = process.env.TZ || 'America/New_York';

let redisClient = null;

const getRedisClient = () => {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;

  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 50, 2000)
  });

  redisClient.on('error', (error) => {
    console.error('[Scheduler] Redis error:', error.message);
  });

  return redisClient;
};

const getRecurrencesForToday = (date) => {
  const day = date.getDay(); // 0=Sun ... 6=Sat
  const isWeekday = day >= 1 && day <= 5;
  const isWeekend = day === 0 || day === 6;

  const recurrences = ['DAILY'];
  if (isWeekday) recurrences.push('WEEKDAYS');
  if (isWeekend) recurrences.push('WEEKENDS');
  return recurrences;
};

const buildTodayStartTime = (sourceStartTime, now) => {
  const source = new Date(sourceStartTime);
  const next = new Date(now);
  next.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return next;
};

const tryAcquireLock = async () => {
  const client = getRedisClient();
  if (!client) {
    return { acquired: true, release: async () => {} };
  }

  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const result = await client.set(LOCK_KEY, token, 'NX', 'EX', LOCK_TTL_SECONDS);

  if (result !== 'OK') {
    return { acquired: false, release: async () => {} };
  }

  const release = async () => {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;
    try {
      await client.eval(script, 1, LOCK_KEY, token);
    } catch (error) {
      console.error('[Scheduler] Lock release error:', error.message);
    }
  };

  return { acquired: true, release };
};

const reactivateRecurringTrips = async () => {
  const now = new Date();
  const recurrences = getRecurrencesForToday(now);

  const recurringTrips = await Trip.find({
    recurrence: { $in: recurrences },
    isActive: false
  }).select('_id startTime routeName recurrence').lean();

  if (!recurringTrips.length) {
    console.log('[Scheduler] No recurring trips to reactivate.');
    return;
  }

  const operations = recurringTrips.map((trip) => ({
    updateOne: {
      filter: { _id: trip._id, isActive: false },
      update: {
        $set: {
          isActive: true,
          status: 'SCHEDULED',
          startTime: buildTodayStartTime(trip.startTime, now),
          endTime: null,
          currentStopIndex: 0
        }
      }
    }
  }));

  const result = await Trip.bulkWrite(operations, { ordered: false });
  const modified = result?.modifiedCount || 0;

  console.log(`[Scheduler] Reactivated ${modified}/${recurringTrips.length} recurring trips.`);
};

const initScheduler = () => {
  const timezone = process.env.SCHEDULER_TIMEZONE || DEFAULT_TIMEZONE;
  console.log(`[Scheduler] Initialized. Daily recurring reactivation at 00:01 (${timezone}).`);

  cron.schedule(
    '1 0 * * *',
    async () => {
      let releaseLock = async () => {};

      try {
        const { acquired, release } = await tryAcquireLock();
        releaseLock = release;

        if (!acquired) {
          console.log('[Scheduler] Skipping run (lock held by another worker/instance).');
          return;
        }

        await reactivateRecurringTrips();
      } catch (error) {
        console.error('[Scheduler] Reactivation error:', error);
      } finally {
        await releaseLock();
      }
    },
    { timezone }
  );
};

module.exports = initScheduler;
