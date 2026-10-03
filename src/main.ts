import { createApp } from "vue"
import App from "./App.vue"
import "./assets/main.css"
import { Launch, Start } from "./lifecycle"

await Start()
createApp(App).mount("#app")
void Launch()
