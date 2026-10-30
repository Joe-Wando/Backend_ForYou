import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @IsString()
  @MinLength(3, { message: "L'identifiant doit faire au moins 3 caractères." })
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: "L'identifiant ne peut contenir que des lettres, chiffres, points, tirets et _.",
  })
  username!: string;

  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit faire au moins 10 caractères.' })
  @MaxLength(200)
  password!: string;
}
