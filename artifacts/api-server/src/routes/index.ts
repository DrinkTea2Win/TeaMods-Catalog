import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import modsRouter from "./mods";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(modsRouter);

export default router;
