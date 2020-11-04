import { expose, workerThreadsExposer } from "airpc";
import { Room } from "../../../../src";

expose(new Room(), workerThreadsExposer());
