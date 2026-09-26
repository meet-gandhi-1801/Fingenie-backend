const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});

const importQueue = new Queue('document-import', { connection });

const queueDocumentImport = async (jobId, fileBuffer, mimeType, userId, originalname) => {
    const payload = {
        jobId,
        fileData: fileBuffer.toString('base64'),
        mimeType,
        userId,
        originalname
    };

    await importQueue.add('import-job', payload, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: true
    });
};

module.exports = {
    importQueue,
    queueDocumentImport
};
