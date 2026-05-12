import { Router } from "express";
import isLoggedIn from "../middlewares/isLoggedin.js";
import authRoles from "../middlewares/authRoles.js";
import * as controller from "../controllers/branch.controller.js";

const router = Router();

// Branch management
router.post("/add", isLoggedIn, authRoles(["admin"]), controller.addBranch);
// Public — paired with /all above so the profile-page dropdowns can load
// branches without needing the cross-service auth cookie.
router.get("/all", controller.getAllBranches);
router.put("/update/:branchId", isLoggedIn, authRoles(["admin"]), controller.updateBranch);
router.delete("/delete/:branchId", isLoggedIn, authRoles(["admin"]), controller.deleteBranch);

// College-Branch relations
router.post("/assign", isLoggedIn, authRoles(["admin"]), controller.assignBranchesToCollege);

export default router;
