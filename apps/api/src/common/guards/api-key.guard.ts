import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey =
      request.headers['x-api-key'] ||
      request.headers['authorization']?.replace('Bearer ', '');

    const validApiKey = this.configService.get<string>('API_KEY');

    // If no API_KEY is set, allow all requests (for development)
    if (!validApiKey) {
      return true;
    }

    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
