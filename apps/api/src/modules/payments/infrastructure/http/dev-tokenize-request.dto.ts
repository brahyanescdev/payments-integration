import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches } from 'class-validator';

/**
 * Mirrors the real gateway's own card-tokenisation request shape, field for
 * field, so the frontend's tokenisation call is identical in code whether it is
 * pointed at this stub (`PAYMENT_GATEWAY_DRIVER=fake`) or at the real gateway.
 */
export class DevTokenizeRequestDto {
  @ApiProperty()
  @Matches(/^\d{13,19}$/, { message: 'number must be 13 to 19 digits' })
  number!: string;

  @ApiProperty()
  @Matches(/^\d{3,4}$/, { message: 'cvc must be 3 or 4 digits' })
  cvc!: string;

  @ApiProperty()
  @Matches(/^(0[1-9]|1[0-2])$/, { message: 'exp_month must be 01-12' })
  exp_month!: string;

  @ApiProperty()
  @Matches(/^\d{2}$/, { message: 'exp_year must be 2 digits' })
  exp_year!: string;

  @ApiProperty()
  @Length(3, 160)
  card_holder!: string;
}
