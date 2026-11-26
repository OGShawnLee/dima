import type { JwtPayload } from 'jsonwebtoken';
import type { RoleName } from '../schemas/common.schema';

export interface DecodedTokenPayload extends JwtPayload {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': RoleName;
}

declare global {
  namespace Express {
    interface Request {
      decodedToken?: DecodedTokenPayload;
      bitacora: (accion: string, elementoid?: string | number | null) => Promise<void>;
    }
  }
}
