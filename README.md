# WWII: Barbarossa to Berlin

《Barbarossa to Berlin》Rally 双人联机模块，采用独立、数据驱动、确定性的前后端架构。PUG 仅作交互与工程模式参考，BTB 不在运行时导入 PUG。

## 开发入口

- 英文规则检索稿：[docs/BTB_RULES_2006_v1.3.md](docs/BTB_RULES_2006_v1.3.md)
- 中文规则检索稿：[BTB_RULES_2006_v1.3_中文规则.md](BTB_RULES_2006_v1.3_中文规则.md)
- 自动生成的实现覆盖率：[docs/rules-coverage.md](docs/rules-coverage.md)

规则书 PDF、卡牌图片、地图和 `assets/source/` 下的卡图/VASSAL 原始资料属于资料或导入来源；CSV 才是已审核游戏数据。`data.js`、`outputs/`、`tmp/` 和 `work/` 均为可再生成或临时产物，不作为项目源文件维护。Rally 运行资源由 `rally-assets.json` 统一登记。

## 常用命令

```powershell
npm ci
npm run python:sync
npm run check
npm run build:data
npm run validate:data
npm run report:progress
npm run report:coverage
npm test
npm run test:coverage
npm run test:fuzz
npm run build:rally
npm run start:map-editor
```

`npm run check:deps` 强制检查模块依赖方向与循环依赖；`npm run typecheck` 以 `checkJs` 渐进检查核心 JavaScript，不改变 Rally 的 CommonJS 运行方式。Python 素材工具的 Pillow 与 pypdf 版本由 `pyproject.toml` 和 `uv.lock` 管理。

地图编辑器默认地址为 `http://127.0.0.1:8082/tools/map_editor.html`。与 PUG 一致，本地 Rally 的 `server/public/barbarossa-to-berlin` Junction 直接指向项目根目录；`npm run build:rally` 负责生成数据并校验运行资源，不再复制前端文件。
