import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type jwtPayLoad } from '../utils/jwt.ts'

export interface AuthenticatedRequest extends Request {
  user?: jwtPayLoad
}


// Authentication middleware - verifies JWT token
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = await verifyToken(token);

    // Attach user to request
    (req as any).user = payload;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
  }
};

// Authorization middleware - checks global role
export const requireGlobalRole = (allowedRoles: ("student" | "admin")[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    if (!allowedRoles.includes(user.roles.global)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `This action requires one of the following global roles: ${allowedRoles.join(
          ", "
        )}`,
      });
    }

    next();
  };
};

// Authorization middleware - checks team-specific role
export const requireTeamRole = (
  teamId: number | string,
  allowedRoles: string[]
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const teamIdNum =
      typeof teamId === "string" ? parseInt(req.params[teamId]) : teamId;
    const teamRole = user.roles.team.find((t: any) => t.teamId === teamIdNum);

    if (!teamRole || !allowedRoles.includes(teamRole.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `This action requires one of the following team roles: ${allowedRoles.join(
          ", "
        )}`,
      });
    }

    next();
  };
};
