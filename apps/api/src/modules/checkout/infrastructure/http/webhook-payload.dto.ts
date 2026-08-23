import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsObject, IsString, ValidateNested } from 'class-validator';

export class WebhookSignatureDto {
  @ApiProperty({ type: [String] })
  @IsString({ each: true })
  @ArrayMinSize(1)
  properties!: string[];

  @ApiProperty()
  @IsString()
  checksum!: string;
}

/**
 * Body of `POST /webhooks/payments`.
 *
 * `data` stays a plain object rather than a typed shape: the gateway's event
 * payload nests the transaction under a path named by `signature.properties`
 * (e.g. `"transaction.id"`), and the checksum only ever needs those named
 * values read back out generically — typing every event's full shape would add
 * a DTO per event without the verification logic ever using the extra fields.
 */
export class WebhookPayloadDto {
  @ApiProperty()
  @IsString()
  event!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiProperty({ type: WebhookSignatureDto })
  @ValidateNested()
  @Type(() => WebhookSignatureDto)
  signature!: WebhookSignatureDto;

  @ApiProperty()
  @IsInt()
  timestamp!: number;
}
