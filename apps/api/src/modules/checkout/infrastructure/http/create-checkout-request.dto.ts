import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const LEGAL_ID_TYPES = ['CC', 'CE', 'NIT', 'PP'] as const;
const PHONE_PATTERN = /^\d{7,15}$/;

export class CustomerInputDto {
  @ApiProperty()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, { message: 'email must be a valid address' })
  email!: string;

  @ApiProperty()
  @Length(3, 160)
  fullName!: string;

  @ApiProperty()
  @Matches(PHONE_PATTERN, { message: 'phone must have 7 to 15 digits' })
  phone!: string;

  @ApiProperty()
  @Length(5, 32)
  legalId!: string;

  @ApiProperty({ enum: LEGAL_ID_TYPES })
  @IsEnum(LEGAL_ID_TYPES)
  legalIdType!: (typeof LEGAL_ID_TYPES)[number];
}

export class DeliveryInputDto {
  @ApiProperty()
  @Length(3, 160)
  recipientName!: string;

  @ApiProperty()
  @Matches(PHONE_PATTERN, { message: 'phone must have 7 to 15 digits' })
  phone!: string;

  @ApiProperty()
  @Length(5, 200)
  addressLine1!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Length(0, 200)
  addressLine2?: string;

  @ApiProperty()
  @Length(2, 120)
  city!: string;

  @ApiProperty()
  @Length(2, 120)
  region!: string;

  @ApiProperty()
  @Length(2, 2)
  country!: string;

  @ApiProperty()
  @Length(3, 20)
  postalCode!: string;
}

/**
 * Body of `POST /checkout`.
 *
 * Deliberately carries no amount and no card data: the price is computed from the
 * catalogue server-side, and a card is tokenised directly against the gateway in
 * the next vertical slice, never routed through here.
 */
export class CreateCheckoutRequestDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;

  @ApiProperty({ type: CustomerInputDto })
  @ValidateNested()
  @Type(() => CustomerInputDto)
  customer!: CustomerInputDto;

  @ApiProperty({ type: DeliveryInputDto })
  @ValidateNested()
  @Type(() => DeliveryInputDto)
  delivery!: DeliveryInputDto;
}
