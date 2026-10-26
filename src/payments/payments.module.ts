import { Module } from '@nestjs/common';
import { NaboopayClient } from './naboopay.client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, NaboopayClient],
})
export class PaymentsModule {}
