import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Length, Matches, Max, Min } from 'class-validator';

/**
 * Body of `POST /checkout/:id/pay`.
 *
 * No card number, expiry or CVC — `cardToken` is a single-use token the browser
 * already obtained directly from the gateway with the public key. This DTO exists
 * precisely so a raw PAN cannot even be shaped correctly as a request to this
 * endpoint, let alone accepted by it.
 */
export class PayCheckoutRequestDto {
  @ApiProperty()
  @Length(1, 255)
  cardToken!: string;

  @ApiProperty()
  @Length(1, 4096)
  acceptanceToken!: string;

  @ApiProperty()
  @Length(1, 4096)
  acceptPersonalAuthToken!: string;

  @ApiProperty({ minimum: 1, maximum: 36 })
  @IsInt()
  @Min(1)
  @Max(36)
  installments!: number;

  @ApiProperty()
  @Length(1, 32)
  cardBrand!: string;

  @ApiProperty()
  @Matches(/^\d{4}$/, { message: 'cardLastFour must be exactly 4 digits' })
  cardLastFour!: string;
}
