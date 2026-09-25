type GithubInstallationRecord = {
    installationId: string;
    repositories: { id: string; name: string; fullName: string; owner: string; private: boolean; description: string | null; language: string | null; defaultBranch: string }[];
    enabledRepositoryIds: string[];
};

type MongooseModule = typeof import("mongoose");

const connectionState = globalThis as typeof globalThis & {
    mongooseModule?: MongooseModule;
    mongooseConnection?: Promise<MongooseModule>;
};

async function loadMongoose() {
    if (!connectionState.mongooseModule) {
        connectionState.mongooseModule = await import("mongoose");
    }
    return connectionState.mongooseModule;
}

async function connectWithRetry(mongoose: MongooseModule, uri: string) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await mongoose.default.connect(uri, {
                serverSelectionTimeoutMS: 15000,
                connectTimeoutMS: 15000,
                socketTimeoutMS: 45000,
                heartbeatFrequencyMS: 10000,
                maxIdleTimeMS: 30000,
                retryWrites: true,
            });
        } catch (error) {
            lastError = error;
            console.warn(`MongoDB connection attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
            await mongoose.default.disconnect().catch(() => undefined);
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
    throw lastError;
}

function getInstallationModel(mongoose: MongooseModule) {
    const schema = new mongoose.Schema({
        installationId: { type: String, required: true, unique: true },
        accountId: { type: String, required: true },
        accountLogin: { type: String, required: true },
        repositories: [{ id: String, name: String, fullName: String, owner: String, private: Boolean, description: String, language: String, defaultBranch: String }],
        enabledRepositoryIds: { type: [String], default: [] },
    }, { timestamps: true });
    return mongoose.models.GithubInstallation || mongoose.model("GithubInstallation", schema);
}

export async function connectDatabase() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error("MONGODB_URI is not configured");
    const mongoose = await loadMongoose();

    // Check if existing cached connection is still alive
    if (connectionState.mongooseConnection) {
        const readyState = mongoose.default.connection.readyState;
        // 0 = disconnected, 3 = disconnecting — clear stale cache
        if (readyState === 0 || readyState === 3) {
            console.warn("MongoDB connection is stale (readyState:", readyState, "), reconnecting...");
            await mongoose.default.disconnect().catch(() => undefined);
            connectionState.mongooseConnection = undefined;
        }
    }

    connectionState.mongooseConnection ??= connectWithRetry(mongoose, uri).then(() => mongoose).catch((error) => {
        connectionState.mongooseConnection = undefined;
        throw error;
    });
    return connectionState.mongooseConnection;
}

export async function saveGithubInstallation(details: { installationId: string; accountId: string; accountLogin: string; repositories: unknown[] }) {
    const mongoose = await connectDatabase();
    const GithubInstallation = getInstallationModel(mongoose);
    return GithubInstallation.findOneAndUpdate({ installationId: details.installationId }, { ...details }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
}

export async function getGithubInstallation(installationId: string) {
    const mongoose = await connectDatabase();
    const GithubInstallation = getInstallationModel(mongoose);
    return GithubInstallation.findOne({ installationId }).lean() as Promise<GithubInstallationRecord | null>;
}

export async function setRepositoryReviewEnabled(installationId: string, repositoryId: string, enabled: boolean): Promise<GithubInstallationRecord | null> {
    const mongoose = await connectDatabase();
    const GithubInstallation = getInstallationModel(mongoose);
    const update = enabled ? { $addToSet: { enabledRepositoryIds: repositoryId } } : { $pull: { enabledRepositoryIds: repositoryId } };
    return GithubInstallation.findOneAndUpdate({ installationId }, update, { new: true }).lean() as Promise<GithubInstallationRecord | null>;
}