import { expose, workerThreadsExposer } from "airpc";
import { Endpoint } from "../../../packages/core/src";

expose(new Endpoint(), workerThreadsExposer());
