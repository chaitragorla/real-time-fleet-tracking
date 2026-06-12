import { Module, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Module({})
export class DatabaseModule implements OnModuleInit {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    await this.connection.asPromise();
    await this.dropConflictingLegacyIndexes();
    await Promise.all(
      Object.values(this.connection.models).map((model) => model.syncIndexes()),
    );
  }

  private async dropConflictingLegacyIndexes() {
    const collection = this.connection.collection('otp_verifications');
    const exists = await this.connection.db?.listCollections({ name: 'otp_verifications' }).hasNext();
    if (!exists) return;

    const indexes = await collection.indexes();
    const staleExpiresAtIndex = indexes.find(
      (index) =>
        index.name === 'expiresAt_1' &&
        index.key?.expiresAt === 1 &&
        index.expireAfterSeconds === undefined,
    );

    if (staleExpiresAtIndex) {
      await collection.dropIndex('expiresAt_1');
    }
  }
}
