import { Router } from "express";
import {
    createRide,
    getAllRides,
    getRideById,
    joinRideHandler,
    leaveRideHandler,
    deleteRide,
    getJoinedRides,
} from "../controllers/RidesController.ts";

const router = Router();

router.post("/", createRide);
router.get("/", getAllRides);
router.get("/joined", getJoinedRides);
router.get("/:rideId", getRideById);

router.post("/:rideId/join", joinRideHandler);
router.delete("/:rideId/leave", leaveRideHandler);
router.delete("/:rideId", deleteRide);

export default router;
