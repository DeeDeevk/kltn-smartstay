import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CheckoutServiceItemDto } from './check-out.dto';
import { Type } from 'class-transformer';

export class AddServiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutServiceItemDto)
  items!: CheckoutServiceItemDto[];
}
