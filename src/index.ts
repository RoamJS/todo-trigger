import toConfigPageName from "roamjs-components/util/toConfigPageName";
import runExtension from "roamjs-components/util/runExtension";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";

const ID = "todo-trigger";
const CONFIG = toConfigPageName(ID);
runExtension(ID, () => {
  createConfigObserver({ title: CONFIG, config: { tabs: [] } });
});
