const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

const insightQueue = new Queue('insight-generation', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,           // retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000          // wait 2s, 4s, 8s between retries
    },
    removeOnComplete: 100, // keep last 100 completed jobs
    removeOnFail: 50       // keep last 50 failed jobs
  }
});

// Job types
const JOB_TYPES = {
  MONTHLY_INSIGHTS: 'generate-monthly-insights',
  SUBSCRIPTIONS: 'detect-subscriptions',
  SPENDING_ANALYSIS: 'spending-analysis'
};

// Add job to queue
const queueInsightGeneration = async (userId, jobType = null) => {
  const jobs = jobType
    ? [jobType]
    : Object.values(JOB_TYPES); // queue all jobs if no type specified

  for (const type of jobs) {
    await insightQueue.add(type, {
      userId: userId.toString(),
      triggeredAt: new Date().toISOString()
    }, {
      jobId: `${type}-${userId}-${Date.now()}` // unique job ID
    });
  }

  console.log(`Queued ${jobs.length} insight job(s) for user ${userId}`);
};

module.exports = { insightQueue, queueInsightGeneration, JOB_TYPES };
