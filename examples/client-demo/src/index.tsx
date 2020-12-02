import App from "./App";
import { createContext } from "react";
import ReactDOM from "react-dom";
import { ClientSDK } from "../../../packages/client/src";
import { Client } from "./client";

console.log("start");

const endpointURL = (() => {
  //@ts-ignore
  console.log(NODE_ENV);
  //@ts-ignore
  switch (NODE_ENV || "") {
    case "dev":
      return "http://localhost:12222";
    default:
      return "https://node-sfu.tk";
  }
})();

const sdk = new Client(endpointURL);
export const Context = createContext<Client>(sdk);

ReactDOM.render(
  <Context.Provider value={sdk}>
    <App />
  </Context.Provider>,
  document.getElementById("root")
);
