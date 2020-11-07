import { expose, workerThreadsExposer } from "airpc";
import { Room } from "../../../packages/core/src/";

expose(new Room(), workerThreadsExposer());
