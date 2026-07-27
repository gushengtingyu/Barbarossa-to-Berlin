"use strict"

;(function initCatalog(root, factory) {
	const catalog = factory()
	if (typeof module === "object" && module.exports) module.exports = catalog
	else root.BTB_I18N_CATALOG = catalog
})(typeof globalThis === "object" ? globalThis : this, function createCatalog() {
	const source = {
	"about.allied_cards": {
		"params": [],
		"zh-CN": "盟军牌组",
		"en": "Allied deck"
	},
	"about.art": {
		"params": [],
		"zh-CN": "美术指导：Rodger B. MacGowan；地图、卡牌与算子美术：Mark Simonitch。",
		"en": "Art Direction: Rodger B. MacGowan; map, card, and counter art: Mark Simonitch."
	},
	"about.axis_cards": {
		"params": [],
		"zh-CN": "轴心国牌组",
		"en": "Axis deck"
	},
	"about.charts": {
		"params": [],
		"zh-CN": "辅助图表",
		"en": "Player aid charts"
	},
	"about.copyright": {
		"params": [],
		"zh-CN": "版权所有",
		"en": "Copyright"
	},
	"about.game_design": {
		"params": [],
		"zh-CN": "游戏设计 (Game Design)：Ted Raicer。",
		"en": "Game Design: Ted Raicer."
	},
	"about.game_development": {
		"params": [],
		"zh-CN": "游戏开发 (Game Development)：William F. Ramsay, Jr.、Steve Kosakowski。",
		"en": "Game Development: William F. Ramsay, Jr. and Steve Kosakowski."
	},
	"about.gameplay": {
		"params": [],
		"zh-CN": "一方统率轴心国，在时间、距离与资源耗尽之前寻求决定性的胜利；另一方指挥盟军，承受最初的攻势，集结苏联、西方盟军与地中海战场的力量，逐步夺回主动。110张战略牌把作战、调动、补员和历史事件融入每一次抉择；补给线、季节更替、国家政治和登陆窗口，则让每一步推进都伴随着代价。",
		"en": "One player commands the Axis and seeks a decisive victory before time, distance, and resources run out. The other commands the Allies, absorbs the opening assault, and brings Soviet, Western Allied, and Mediterranean strength together to regain the initiative. The 110 strategy cards combine operations, redeployment, replacements, and historical events, while supply, seasons, national politics, and invasion windows give every advance a cost."
	},
	"about.introduction": {
		"params": [],
		"zh-CN": "《二战：巴巴罗萨到柏林》是一款双人卡牌驱动战略游戏，再现1941年6月至1945年5月间席卷欧洲与北非的战争。战局从德军越过苏联国境的黎明展开，穿过莫斯科城下的严冬、北非沙漠、斯大林格勒废墟与诺曼底海岸，最终逼近柏林。",
		"en": "WWII: Barbarossa to Berlin is a two-player card-driven strategy game portraying the war across Europe and North Africa from June 1941 to May 1945. It begins as German forces cross the Soviet frontier and continues through the winter before Moscow, the North African desert, Stalingrad, Normandy, and the final approach to Berlin."
	},
	"about.period": {
		"params": [],
		"zh-CN": "。",
		"en": "."
	},
	"about.pieces": {
		"params": [],
		"zh-CN": "算子图鉴",
		"en": "Unit reference"
	},
	"about.references": {
		"params": [],
		"zh-CN": "参考资料",
		"en": "References"
	},
	"about.rulebook": {
		"params": [],
		"zh-CN": "规则书（2006 v1.3）",
		"en": "Rulebook (2006 v1.3)"
	},
	"about.rules": {
		"params": [],
		"zh-CN": "规则",
		"en": "Rules"
	},
	"action.choose": {
		"params": [
			"turn",
			"round"
		],
		"zh-CN": "第{turn}回合 · 行动轮{round}：选择一项行动。",
		"en": "Turn {turn} · Action Round {round}: choose an action."
	},
	"action.log.auto_ops": {
		"params": [],
		"zh-CN": "自动行动（1）",
		"en": "Automatic action (1)"
	},
	"action.log.card": {
		"params": [
			"card",
			"usage"
		],
		"zh-CN": "{card} -- {usage}",
		"en": "{card} -- {usage}"
	},
	"action.log.partisan": {
		"params": [
			"space"
		],
		"zh-CN": "盟军在{space}放置游击队标记。",
		"en": "The Allies place a Partisan marker in {space}."
	},
	"action.log.phase": {
		"params": [],
		"zh-CN": "行动阶段",
		"en": "Action Phase"
	},
	"action.log.round": {
		"params": [
			"turn",
			"round"
		],
		"zh-CN": "Turn {turn} -- 行动轮 {round}",
		"en": "Turn {turn} -- Action Round {round}"
	},
	"action.partisans.complete": {
		"params": [],
		"zh-CN": "游击队放置完成。",
		"en": "Partisan placement is complete."
	},
	"action.partisans.place": {
		"params": [
			"placed",
			"total"
		],
		"zh-CN": "放置游击队（{placed}/{total}）。",
		"en": "Place Partisans ({placed}/{total})."
	},
	"action.usage.event": {
		"params": [],
		"zh-CN": "事件",
		"en": "Event"
	},
	"action.usage.ops": {
		"params": [
			"ops"
		],
		"zh-CN": "行动点（{ops}）",
		"en": "Operations ({ops})"
	},
	"action.usage.rp": {
		"params": [],
		"zh-CN": "补充（RP）",
		"en": "Replacements (RP)"
	},
	"action.usage.sr": {
		"params": [
			"ops"
		],
		"zh-CN": "战略调动（{ops}）",
		"en": "Strategic Redeployment ({ops})"
	},
	"activation.choose_space": {
		"params": [
			"points"
		],
		"zh-CN": "选择激活空间（剩余 {points} OPS）。",
		"en": "Choose an activation space ({points} OPS remaining)."
	},
	"activation.entrench.none": {
		"params": [],
		"zh-CN": "没有待结算的掘壕尝试。",
		"en": "There are no entrenchment attempts to resolve."
	},
	"activation.entrench.roll": {
		"params": [
			"spaces"
		],
		"zh-CN": "为 {spaces} 的掘壕尝试掷骰。",
		"en": "Roll the entrenchment attempts for {spaces}."
	},
	"activation.log.combat": {
		"params": [],
		"zh-CN": "战斗",
		"en": "Combat"
	},
	"activation.log.entrench_failure": {
		"params": [
			"space",
			"die"
		],
		"zh-CN": "{space}掘壕检定：{die} → 失败",
		"en": "{space} entrenchment attempt: {die} → failure"
	},
	"activation.log.entrench_success": {
		"params": [
			"space",
			"die",
			"level"
		],
		"zh-CN": "{space}掘壕检定：{die} → 成功，堑壕等级{level}",
		"en": "{space} entrenchment attempt: {die} → success, trench level {level}"
	},
	"activation.log.move": {
		"params": [],
		"zh-CN": "移动",
		"en": "Move"
	},
	"activation.log.move_from": {
		"params": [
			"origin"
		],
		"zh-CN": "从 {origin} 移动",
		"en": "Move from {origin}"
	},
	"activation.log.move_piece": {
		"params": [
			"piece",
			"destination"
		],
		"zh-CN": "{piece} → {destination}",
		"en": "{piece} → {destination}"
	},
	"activation.log.space": {
		"params": [
			"space"
		],
		"zh-CN": "{space}",
		"en": "{space}"
	},
	"activation.log.space_cost": {
		"params": [
			"space",
			"cost"
		],
		"zh-CN": "{space}（{cost} OPS）",
		"en": "{space} ({cost} OPS)"
	},
	"activation.log.sr": {
		"params": [],
		"zh-CN": "战略调动",
		"en": "Strategic Redeployment"
	},
	"activation.log.sr_move": {
		"params": [
			"piece",
			"origin",
			"destination"
		],
		"zh-CN": "{piece}：{origin} → {destination}",
		"en": "{piece}: {origin} → {destination}"
	},
	"activation.move.choose_group": {
		"params": [],
		"zh-CN": "选择同一空间中一起移动的单位，再选择相邻空间。",
		"en": "Choose units in the same space to move together, then choose an adjacent space."
	},
	"activation.move.group_distance": {
		"params": [
			"distance"
		],
		"zh-CN": "移动组已走 {distance} 格。",
		"en": "The moving group has moved {distance} spaces."
	},
	"activation.move.units": {
		"params": [],
		"zh-CN": "移动已激活空间中的单位。",
		"en": "Move units in activated spaces."
	},
	"activation.sr.choose_piece": {
		"params": [
			"points"
		],
		"zh-CN": "选择战略调动单位（剩余 {points} SR）。",
		"en": "Choose a Strategic Redeployment unit ({points} SR remaining)."
	},
	"activation.sr.destination": {
		"params": [],
		"zh-CN": "选择战略调动目的地。",
		"en": "Choose a Strategic Redeployment destination."
	},
	"activation.sr.stalin_destination": {
		"params": [],
		"zh-CN": "选择斯大林战略调动目的地。",
		"en": "Choose Stalin's Strategic Redeployment destination."
	},
	"combat.advance.choose": {
		"params": [],
		"zh-CN": "选择推进单位。",
		"en": "Choose advancing units."
	},
	"combat.advance.destination": {
		"params": [],
		"zh-CN": "选择一起推进的单位，再选择目的地。",
		"en": "Choose units to advance together, then choose their destination."
	},
	"combat.attacker.cards": {
		"params": [],
		"zh-CN": "进攻方：打出战斗卡。",
		"en": "Attacker: play combat cards."
	},
	"combat.attacker.cards_none": {
		"params": [],
		"zh-CN": "进攻方：打出战斗卡（无）。",
		"en": "Attacker: play combat cards (none available)."
	},
	"combat.attacker.losses": {
		"params": [
			"remaining"
		],
		"zh-CN": "进攻方分配损失（剩余 {remaining}）。",
		"en": "Attacker assigns losses ({remaining} remaining)."
	},
	"combat.confirm": {
		"params": [
			"target",
			"attacker",
			"defender"
		],
		"zh-CN": "确认进攻{target}：{attacker} CF VS {defender} CF。",
		"en": "Confirm the attack on {target}: {attacker} CF vs {defender} CF."
	},
	"combat.confirm.empty_beachhead": {
		"params": [
			"target"
		],
		"zh-CN": "确认攻击{target}的空置滩头（无需掷骰）。",
		"en": "Confirm the attack on the empty beachhead at {target} (no die roll)."
	},
	"combat.defender.cards": {
		"params": [],
		"zh-CN": "防守方：打出战斗卡。",
		"en": "Defender: play combat cards."
	},
	"combat.defender.cards_none": {
		"params": [],
		"zh-CN": "防守方：打出战斗卡（无）。",
		"en": "Defender: play combat cards (none available)."
	},
	"combat.defender.losses": {
		"params": [
			"remaining"
		],
		"zh-CN": "防守方分配损失（剩余 {remaining}）。",
		"en": "Defender assigns losses ({remaining} remaining)."
	},
	"combat.extra_attack.confirm": {
		"params": [
			"event"
		],
		"zh-CN": "{event}：发动指定集团军的第二次攻击？",
		"en": "{event}: make the designated army's second attack?"
	},
	"combat.extra_attack.target": {
		"params": [
			"event"
		],
		"zh-CN": "{event}：选择第二次攻击的目标。",
		"en": "{event}: choose the target of the second attack."
	},
	"combat.fire_summary": {
		"params": [
			"strength",
			"table"
		],
		"zh-CN": "{strength} CF（{table}）",
		"en": "{strength} CF ({table})"
	},
	"combat.fire_summary.shifted": {
		"params": [
			"strength",
			"table",
			"column"
		],
		"zh-CN": "{strength} CF（{table}→{column}列）",
		"en": "{strength} CF ({table}→column {column})"
	},
	"combat.log.advance": {
		"params": [
			"space"
		],
		"zh-CN": "推进：{space}",
		"en": "Advance: {space}"
	},
	"combat.log.attacker": {
		"params": [],
		"zh-CN": "进攻方：",
		"en": "Attacker:"
	},
	"combat.log.attacker_aborted": {
		"params": [
			"space"
		],
		"zh-CN": "进攻单位在战斗结算前已全部消灭，{space}的进攻中止。",
		"en": "All attacking units were eliminated before combat resolution; abort the attack on {space}."
	},
	"combat.log.attacker_fire": {
		"params": [],
		"zh-CN": "进攻方开火：",
		"en": "Attacker fires:"
	},
	"combat.log.attacker_none": {
		"params": [],
		"zh-CN": "进攻方：无",
		"en": "Attacker: none"
	},
	"combat.log.attacker_takes_losses": {
		"params": [],
		"zh-CN": "进攻方承伤：",
		"en": "Attacker losses:"
	},
	"combat.log.attackers": {
		"params": [
			"pieces",
			"origin"
		],
		"zh-CN": "{pieces}（{origin}）",
		"en": "{pieces} ({origin})"
	},
	"combat.log.beachhead_removed": {
		"params": [],
		"zh-CN": "轴心国攻击空置滩头，无需掷骰即将其移除。",
		"en": "The Axis attacks an empty beachhead and removes it without a die roll."
	},
	"combat.log.card_played": {
		"params": [
			"role",
			"card"
		],
		"zh-CN": "{role}：{card}",
		"en": "{role}: {card}"
	},
	"combat.log.cards": {
		"params": [],
		"zh-CN": "战斗卡：",
		"en": "Combat cards:"
	},
	"combat.log.defender": {
		"params": [],
		"zh-CN": "防守方：",
		"en": "Defender:"
	},
	"combat.log.defender_fire": {
		"params": [],
		"zh-CN": "防守方开火：",
		"en": "Defender fires:"
	},
	"combat.log.defender_none": {
		"params": [],
		"zh-CN": "防守方：无",
		"en": "Defender: none"
	},
	"combat.log.defender_takes_losses": {
		"params": [],
		"zh-CN": "防守方承伤：",
		"en": "Defender losses:"
	},
	"combat.log.defenders": {
		"params": [
			"pieces"
		],
		"zh-CN": "{pieces}",
		"en": "{pieces}"
	},
	"combat.log.eliminated": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}消灭",
		"en": "{piece} eliminated"
	},
	"combat.log.eliminated_permanent": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}永久消灭",
		"en": "{piece} permanently eliminated"
	},
	"combat.log.eliminated_replaced": {
		"params": [
			"piece",
			"replacement"
		],
		"zh-CN": "{piece}消灭，由{replacement}替代",
		"en": "{piece} eliminated and replaced by {replacement}"
	},
	"combat.log.eliminated_replaced_permanent": {
		"params": [
			"piece",
			"replacement"
		],
		"zh-CN": "{piece}永久消灭，由{replacement}替代",
		"en": "{piece} permanently eliminated and replaced by {replacement}"
	},
	"combat.log.failed_retreat": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}无法完成撤退，按断补规则消灭。",
		"en": "{piece} cannot complete its retreat and is eliminated under the out-of-supply rules."
	},
	"combat.log.fire_result": {
		"params": [
			"die",
			"column",
			"loss"
		],
		"zh-CN": "{die} × {column}列 = {loss}",
		"en": "{die} × column {column} = {loss}"
	},
	"combat.log.overview": {
		"params": [
			"space"
		],
		"zh-CN": "战斗：{space}",
		"en": "Combat: {space}"
	},
	"combat.log.panzerfaust": {
		"params": [
			"piece"
		],
		"zh-CN": "『铁拳』使{piece}在战斗结算前损失一个步级。",
		"en": "Panzerfaust causes {piece} to lose one step before combat resolution."
	},
	"combat.log.piece": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}",
		"en": "{piece}"
	},
	"combat.log.previously_retreated_eliminated": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}本行动轮此前已经退却，因本次进攻造成损失而立即消灭。",
		"en": "{piece} had already retreated this Action Round and is immediately eliminated after the attack inflicts a loss."
	},
	"combat.log.reduced": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}减员",
		"en": "{piece} reduced"
	},
	"combat.panzerfaust.loss": {
		"params": [],
		"zh-CN": "『铁拳』：选择一个苏军机械化单位损失一步。",
		"en": "Panzerfaust: choose one Soviet mechanized unit to lose one step."
	},
	"combat.retreat.cancel_complete": {
		"params": [],
		"zh-CN": "撤退取消已完成。",
		"en": "Retreat cancellation is complete."
	},
	"combat.retreat.cancel_option": {
		"params": [],
		"zh-CN": "防守方可以额外承受 1 级损失以取消撤退。",
		"en": "The defender may take one additional step loss to cancel the retreat."
	},
	"combat.retreat.choose_path": {
		"params": [
			"remaining"
		],
		"zh-CN": "选择撤退路径（剩余 {remaining} 格）。",
		"en": "Choose a retreat path ({remaining} spaces remaining)."
	},
	"combat.retreat.choose_units": {
		"params": [
			"distance"
		],
		"zh-CN": "选择撤退单位（{distance} 格）。",
		"en": "Choose units to retreat ({distance} spaces)."
	},
	"combat.retreat.complete": {
		"params": [],
		"zh-CN": "撤退已完成。",
		"en": "Retreat is complete."
	},
	"combat.select_attack": {
		"params": [],
		"zh-CN": "选择进攻单位和目标。",
		"en": "Choose attacking units and a target."
	},
	"core.blank": {
		"params": [],
		"zh-CN": "",
		"en": ""
	},
	"core.game_over": {
		"params": [],
		"zh-CN": "游戏结束。",
		"en": "Game over."
	},
	"core.log.rollback_accepted": {
		"params": [
			"name"
		],
		"zh-CN": "双方同意回滚到：{name}。",
		"en": "Both players agree to roll back to: {name}."
	},
	"core.log.supply_acknowledged": {
		"params": [
			"side",
			"count"
		],
		"zh-CN": "{side}确认收到{count}处补给警告。",
		"en": "{side} acknowledges {count} supply warnings."
	},
	"core.none": {
		"params": [],
		"zh-CN": "无",
		"en": "none"
	},
	"core.replay.debug": {
		"params": [
			"entry"
		],
		"zh-CN": "回放调试：{entry}",
		"en": "Replay debug: {entry}"
	},
	"core.role.allied": {
		"params": [],
		"zh-CN": "盟军",
		"en": "Allied"
	},
	"core.role.axis": {
		"params": [],
		"zh-CN": "轴心国",
		"en": "Axis"
	},
	"core.rollback.action_round": {
		"params": [
			"turn",
			"round",
			"side"
		],
		"zh-CN": "第{turn}回合 · 第{round}行动轮 · {side}行动前",
		"en": "Turn {turn} · Action Round {round} · before the {side} action"
	},
	"core.rollback.turn_start": {
		"params": [
			"turn",
			"side"
		],
		"zh-CN": "第{turn}回合开始 · {side}行动前",
		"en": "Start of Turn {turn} · before the {side} action"
	},
	"core.waiting": {
		"params": [
			"role"
		],
		"zh-CN": "等待 {role} 行动",
		"en": "Waiting for {role}"
	},
	"create.campaign_description": {
		"params": [],
		"zh-CN": "：轴心国与盟军进行18回合对局，从巴巴罗萨行动开始，直到柏林战役或提前达成自动胜利。",
		"en": ": The Axis and Allied sides play an 18-turn campaign, beginning with Operation Barbarossa and ending with the Battle of Berlin or an earlier automatic victory."
	},
	"create.campaign_name": {
		"params": [],
		"zh-CN": "完整战役",
		"en": "Campaign"
	},
	"create.card_language": {
		"params": [],
		"zh-CN": "卡牌语言（Card language）：",
		"en": "Card language:"
	},
	"create.chinese": {
		"params": [],
		"zh-CN": "中文",
		"en": "Chinese"
	},
	"create.chinese_cards": {
		"params": [],
		"zh-CN": "中文卡牌",
		"en": "Chinese cards"
	},
	"create.interface_language": {
		"params": [],
		"zh-CN": "界面语言（UI language）：",
		"en": "界面语言（UI language）："
	},
	"create.optional_rules": {
		"params": [],
		"zh-CN": "选规",
		"en": "Optional rules"
	},
	"create.rule.invasion": {
		"params": [],
		"zh-CN": "1942年夏季前禁止盟军入侵",
		"en": "No Allied invasions before Summer 1942"
	},
	"create.rule.invasion_help": {
		"params": [],
		"zh-CN": "盟军在1942年夏季回合前不得将登陆牌作为入侵事件打出。",
		"en": "The Allies may not play an invasion card as an invasion event before the Summer 1942 turn."
	},
	"create.rule.invasion_help_label": {
		"params": [],
		"zh-CN": "查看盟军早期入侵限制说明",
		"en": "View the early Allied invasion restriction"
	},
	"create.rule.italy": {
		"params": [],
		"zh-CN": "意大利晴空",
		"en": "Sunny Italy"
	},
	"create.rule.italy_help": {
		"params": [],
		"zh-CN": "秋季与冬季回合中，那不勒斯作为补给源时只提供有限补给。",
		"en": "During Fall and Winter turns, Naples provides only Limited Supply when used as a supply source."
	},
	"create.rule.italy_help_label": {
		"params": [],
		"zh-CN": "查看意大利晴空说明",
		"en": "View the Sunny Italy rule"
	},
	"create.rule.mud": {
		"params": [],
		"zh-CN": "泥泞时节",
		"en": "Time of Mud"
	},
	"create.rule.mud_help": {
		"params": [],
		"zh-CN": "1941年秋季第2与第3行动轮，德国机械化单位受到选规规定的移动与战斗限制。",
		"en": "During Action Rounds 2 and 3 of Fall 1941, German mechanized units are subject to the optional movement and combat restrictions."
	},
	"create.rule.mud_help_label": {
		"params": [],
		"zh-CN": "查看泥泞时节说明",
		"en": "View the Time of Mud rule"
	},
	"create.rule.reinforcement": {
		"params": [],
		"zh-CN": "1941年苏军增援限制",
		"en": "1941 Soviet reinforcement restriction"
	},
	"create.rule.reinforcement_help": {
		"params": [],
		"zh-CN": "1941年内，盟军第2号与第24号苏军增援事件只能打出其中一张；另一张仍可作非事件用途使用。",
		"en": "During 1941, only one of Allied events 2 and 24 may be played as an event; the other remains available for non-event use."
	},
	"create.rule.reinforcement_help_label": {
		"params": [],
		"zh-CN": "查看苏军增援限制说明",
		"en": "View the Soviet reinforcement restriction"
	},
	"event.enigma.play": {
		"params": [
			"cards"
		],
		"zh-CN": "恩尼格玛：本行动中轴心国公开手牌：{cards}。",
		"en": "Enigma: the Axis hand is public for this action: {cards}."
	},
	"event.foreign_armies_east.reveal": {
		"params": [
			"cards"
		],
		"zh-CN": "东方外军处：盟军公开手中的指定牌：{cards}。",
		"en": "Foreign Armies East: the Allied player reveals the specified cards: {cards}."
	},
	"event.foreign_armies_east.reveal_final": {
		"params": [
			"cards"
		],
		"zh-CN": "东方外军处：盟军在回合末再次公开未打出的指定牌：{cards}。",
		"en": "Foreign Armies East: at the end of the turn, the Allied player again reveals the specified unplayed cards: {cards}."
	},
	"event.krim.play": {
		"params": [],
		"zh-CN": "克里木：本行动中对塞瓦斯托波尔的一次攻击忽略苏军要塞战斗效果。",
		"en": "Krim: one attack on Sevastopol during this action ignores the Soviet fort's combat effects."
	},
	"event.log.allied_deploy": {
		"params": [
			"piece",
			"space"
		],
		"zh-CN": "盟军将{piece}部署至{space}。",
		"en": "The Allies deploy {piece} to {space}."
	},
	"event.log.allied_replace": {
		"params": [
			"space",
			"new_piece",
			"old_piece"
		],
		"zh-CN": "盟军在{space}以{new_piece}替换{old_piece}。",
		"en": "At {space}, the Allies replace {old_piece} with {new_piece}."
	},
	"event.log.allied_replace_removed": {
		"params": [
			"space",
			"new_piece",
			"old_piece"
		],
		"zh-CN": "盟军在{space}以{new_piece}替换{old_piece}；原方面军移出游戏。",
		"en": "At {space}, the Allies replace {old_piece} with {new_piece}; remove the original Front from the game."
	},
	"event.log.antwerp": {
		"params": [],
		"zh-CN": "安特卫普港现已开放。",
		"en": "The port of Antwerp is now open."
	},
	"event.log.asw_victory": {
		"params": [
			"vp"
		],
		"zh-CN": "反潜战胜利：此后不得打出狼群，VP-1，当前{vp}。",
		"en": "ASW Victory: Wolfpacks may no longer be played; VP -1, now {vp}."
	},
	"event.log.atlantic_wall_complete": {
		"params": [
			"spaces"
		],
		"zh-CN": "大西洋壁垒完成：在{spaces}放置 1 级大西洋壁垒堑壕。",
		"en": "Atlantic Wall complete: place Level-1 Atlantic Wall trenches in {spaces}."
	},
	"event.log.atlantic_wall_select": {
		"params": [],
		"zh-CN": "大西洋壁垒：选择 2 个与 A–I 登陆滩相连的轴心国控制空间。",
		"en": "Atlantic Wall: choose two Axis-controlled spaces connected to invasion beaches A–I."
	},
	"event.log.axis_action": {
		"params": [],
		"zh-CN": "轴心行动生效：德国集团军现在可以进入博洛尼亚—拉斯佩齐亚以南的意大利与西西里，并解锁斯科尔兹内事件。",
		"en": "Axis Action is in effect: German armies may now enter Italy south of Bologna–La Spezia and Sicily, and the Skorzeny event is enabled."
	},
	"event.log.axis_deploy": {
		"params": [
			"piece",
			"space"
		],
		"zh-CN": "轴心国将{piece}部署至{space}。",
		"en": "The Axis deploys {piece} to {space}."
	},
	"event.log.axis_satellites": {
		"params": [
			"piece1",
			"space1",
			"piece2",
			"space2"
		],
		"zh-CN": "轴心国卫星国：{piece1}部署至{space1}，{piece2}部署至{space2}。",
		"en": "Axis Satellites: deploy {piece1} to {space1} and {piece2} to {space2}."
	},
	"event.log.axis_transfer_reserve": {
		"params": [
			"piece",
			"space"
		],
		"zh-CN": "轴心国将{piece}从{space}调回预备箱。",
		"en": "The Axis returns {piece} from {space} to the Reserve Box."
	},
	"event.log.banzai_none": {
		"params": [],
		"zh-CN": "万岁冲锋：没有可移出游戏的英联邦军。",
		"en": "Banzai: there are no Commonwealth corps available to remove from the game."
	},
	"event.log.banzai_removed": {
		"params": [
			"pieces"
		],
		"zh-CN": "万岁冲锋：盟军将{pieces}移出游戏。",
		"en": "Banzai: the Allies remove {pieces} from the game."
	},
	"event.log.banzai_select": {
		"params": [],
		"zh-CN": "万岁冲锋：盟军须依次从地图、预备箱、已消灭单位池选择两个英联邦军移出游戏。",
		"en": "Banzai: the Allies must choose two Commonwealth corps in order from the map, Reserve Box, and Eliminated Units Box to remove from the game."
	},
	"event.log.bomb_plot": {
		"params": [],
		"zh-CN": "炸弹密谋：此后忽略希特勒命令时，每个标记下的德国单位须支付1 VP。",
		"en": "Bomb Plot: whenever Hitler Orders are ignored, pay 1 VP for each German unit under a marker."
	},
	"event.log.bomber_command": {
		"params": [],
		"zh-CN": "轰炸机司令部：轴心国在下一抽牌阶段的手牌上限减少2。",
		"en": "Bomber Command: the Axis hand limit is reduced by two in the next Draw Strategy Phase."
	},
	"event.log.bunker": {
		"params": [
			"space"
		],
		"zh-CN": "地堡：在{space}放置 1 级德军堑壕；此后不能打出国家堡垒事件。",
		"en": "Bunker: place a Level-1 German trench in {space}; National Redoubt may no longer be played."
	},
	"event.log.card_discarded": {
		"params": [
			"side",
			"card"
		],
		"zh-CN": "{side}随机弃置{card}。",
		"en": "{side} randomly discards {card}."
	},
	"event.log.combat_markers_five": {
		"params": [],
		"zh-CN": "在至多5个含轴心单位的空间放置战斗标记；本行动轮德国单位对苏军攻击+1 DRM。",
		"en": "Place Combat markers in up to five spaces containing Axis units; German attacks against Soviet units receive +1 DRM this Action Round."
	},
	"event.log.combat_markers_four_auto_ops": {
		"params": [],
		"zh-CN": "在至多4个含轴心单位的空间放置战斗标记；第2回合第5行动轮前必须连续执行两个自动1 OPS行动。",
		"en": "Place Combat markers in up to four spaces containing Axis units; before Action Round 5 of Turn 2, take two consecutive automatic 1 OPS actions."
	},
	"event.log.east_wall_complete": {
		"params": [
			"spaces"
		],
		"zh-CN": "东方壁垒完成：在{spaces}放置 1 级德军堑壕。",
		"en": "East Wall complete: place Level-1 German trenches in {spaces}."
	},
	"event.log.east_wall_select": {
		"params": [],
		"zh-CN": "东方壁垒：选择 3 个苏联境内、含完整补给德国集团军且没有堑壕的格。",
		"en": "East Wall: choose three unentrenched Soviet spaces containing fully supplied German armies."
	},
	"event.log.eighth_air_force": {
		"params": [],
		"zh-CN": "美国第8航空队：轴心国在下一抽牌阶段的手牌上限减少2。",
		"en": "US 8th Air Force: the Axis hand limit is reduced by two in the next Draw Strategy Phase."
	},
	"event.log.enigma": {
		"params": [],
		"zh-CN": "恩尼格玛：本行动中轴心国手牌向盟军玩家公开。",
		"en": "Enigma: reveal the Axis hand to the Allied player for this action."
	},
	"event.log.fall_blau": {
		"params": [],
		"zh-CN": "蓝色方案生效：放置 5 个战斗标记，本行动轮轴心国对苏军攻击 +1 DRM，并可攻击斯大林格勒、迈科普与阿尔马维尔。",
		"en": "Fall Blau is in effect: place five Combat markers; Axis attacks against Soviet units receive +1 DRM this Action Round, and Stalingrad, Maikop, and Armavir may be attacked."
	},
	"event.log.final_production_complete": {
		"params": [
			"pieces"
		],
		"zh-CN": "最后生产冲刺完成：{pieces}恢复满编；下次抽牌自动补至 7 张，从下一回合起被消灭的德军装甲单位不能重建。",
		"en": "Final Production Surge complete: {pieces} return to full strength; automatically draw to seven cards next Draw Phase, and eliminated German Panzer units may not be rebuilt beginning next turn."
	},
	"event.log.final_production_select": {
		"params": [],
		"zh-CN": "最后生产冲刺：选择 3 个减员的德国装甲集团军。",
		"en": "Final Production Surge: choose three reduced German Panzer armies."
	},
	"event.log.finland_withdraws": {
		"params": [
			"vp"
		],
		"zh-CN": "芬兰退出战争：轴心国VP-1，当前{vp}。",
		"en": "Finland Withdraws: Axis VP -1, now {vp}."
	},
	"event.log.fortress": {
		"params": [
			"space"
		],
		"zh-CN": "国家堡垒：{space}成为完整轴心国补给源；此后不能打出地堡事件。",
		"en": "National Redoubt: {space} becomes a full Axis supply source; Bunker may no longer be played."
	},
	"event.log.fw190": {
		"params": [
			"vp"
		],
		"zh-CN": "FW-190取消本回合美国第8航空队的效果：VP+1，当前{vp}。",
		"en": "FW-190 cancels US 8th Air Force for this turn: VP +1, now {vp}."
	},
	"event.log.guderian": {
		"params": [],
		"zh-CN": "古德里安装甲集群：德国第2装甲集团军完成首次攻击后，可在全部常规战斗结束时再攻击一次；第二次战斗最多推进一格。",
		"en": "Guderian Panzer Group: after the German 2nd Panzer Army completes its first attack, it may attack again after all regular combats; the second combat may advance at most one space."
	},
	"event.log.hedgehogs_complete": {
		"params": [
			"spaces"
		],
		"zh-CN": "刺猬阵地完成：在{spaces}放置 1 级德军堑壕；本回合苏联境内德军可使用不退却。",
		"en": "Hedgehogs complete: place Level-1 German trenches in {spaces}; German units in the Soviet Union may use No Retreat this turn."
	},
	"event.log.hedgehogs_select": {
		"params": [],
		"zh-CN": "刺猬阵地：选择 3 个苏联境内、含完整补给德国集团军且没有堑壕的格。",
		"en": "Hedgehogs: choose three unentrenched Soviet spaces containing fully supplied German armies."
	},
	"event.log.herkules": {
		"params": [
			"space",
			"losses"
		],
		"zh-CN": "赫拉克勒斯行动：轴心国控制{space}{losses}；只要马耳他仍由轴心国控制，北非轴心国单位可经的黎波里或突尼斯获得完整海运补给。",
		"en": "Operation Herkules: the Axis controls {space}{losses}; while Malta remains Axis-controlled, Axis units in North Africa may trace full sea supply through Tripoli or Tunis."
	},
	"event.log.herkules_losses": {
		"params": [
			"pieces"
		],
		"zh-CN": "，其上{pieces}进入盟军被消灭区",
		"en": "; {pieces} there enter the Allied Eliminated Units Box"
	},
	"event.log.hitler_command": {
		"params": [],
		"zh-CN": "希特勒接管指挥生效：解锁总体战、蓝色方案、堡垒行动与守望莱茵，禁止古德里安装甲集群；此后轴心国命令掷骰 +2 DRM。",
		"en": "Hitler Takes Command is in effect: enable Totaler Krieg, Fall Blau, Zitadelle, and Wacht am Rhein; prohibit Guderian Panzer Group; Axis Orders rolls receive +2 DRM."
	},
	"event.log.italian_navy": {
		"params": [],
		"zh-CN": "意大利海军出击：本回合北非轴心国单位可经的黎波里或突尼斯获得完整海运补给，并可放置一个移动或战斗标记。",
		"en": "Italian Naval Sortie: this turn Axis units in North Africa may trace full sea supply through Tripoli or Tunis, and the Axis may place one Move or Combat marker."
	},
	"event.log.ix_tac_air": {
		"params": [],
		"zh-CN": "第九战术航空队：本行动轮纯英军或美军攻击获得+1 DRM。",
		"en": "IX Tactical Air: all-British or all-US attacks receive +1 DRM this Action Round."
	},
	"event.log.kammhuber": {
		"params": [],
		"zh-CN": "卡姆胡伯防线取消本回合轰炸机司令部的效果。",
		"en": "Kammhuber Line cancels Bomber Command for this turn."
	},
	"event.log.krim": {
		"params": [],
		"zh-CN": "克里木：本行动中对塞瓦斯托波尔的一次攻击忽略苏军要塞战斗效果。",
		"en": "Krim: one attack on Sevastopol during this action ignores the Soviet fort's combat effects."
	},
	"event.log.luftwaffe_supply": {
		"params": [],
		"zh-CN": "空军补给：选择一个含断补轴心单位的空间；其中轴心单位本回合仅在防御与损耗时视为有限补给。",
		"en": "Luftwaffe Supply: choose a space containing out-of-supply Axis units; those units are treated as in Limited Supply only for defense and Attrition this turn."
	},
	"event.log.manstein": {
		"params": [
			"removed"
		],
		"zh-CN": "曼施坦因取消本回合轴心国命令及其处罚{removed}。",
		"en": "Manstein cancels Axis Orders and their penalty for this turn{removed}."
	},
	"event.log.mechanized_fronts": {
		"params": [],
		"zh-CN": "从下一回合起可打出第31、37和39号苏军机械化方面军增援。",
		"en": "Soviet mechanized Front reinforcements 31, 37, and 39 become playable beginning next turn."
	},
	"event.log.neutral_vp": {
		"params": [
			"penalty",
			"vp"
		],
		"zh-CN": "中立VP空间视为盟军控制，轴心国VP-{penalty}，当前{vp}。",
		"en": "Neutral VP spaces are treated as Allied-controlled: Axis VP -{penalty}, now {vp}."
	},
	"event.log.nordlicht": {
		"params": [],
		"zh-CN": "北极光行动生效：此后可攻击列宁格勒；本行动轮轴心国只能攻击列宁格勒。",
		"en": "Nordlicht is in effect: Leningrad may now be attacked; the Axis may attack only Leningrad this Action Round."
	},
	"event.log.okh_conference": {
		"params": [],
		"zh-CN": "陆军总部会议生效：此后打出台风行动不承受 VP 惩罚。",
		"en": "OKH Conference is in effect: Taifun no longer incurs its VP penalty."
	},
	"event.log.p51": {
		"params": [],
		"zh-CN": "P-51“野马”：此后不得打出FW-190，并允许打出绞杀行动和第九战术航空队。",
		"en": "P-51 Mustang: FW-190 may no longer be played; Operation Strangle and IX Tactical Air are enabled."
	},
	"event.log.panzer_refit_complete": {
		"params": [
			"pieces"
		],
		"zh-CN": "装甲部队整补完成：{pieces}恢复满编；本行动轮不能激活其所在格。",
		"en": "Panzer Refit complete: {pieces} return to full strength; their spaces may not be activated this Action Round."
	},
	"event.log.panzer_refit_select": {
		"params": [],
		"zh-CN": "装甲部队整补：选择 3 个有补给的减员德国装甲单位。",
		"en": "Panzer Refit: choose three supplied reduced German Panzer units."
	},
	"event.log.partisan_expanded": {
		"params": [],
		"zh-CN": "扩大游击队适用国家并立即放置1个游击队标记。",
		"en": "Expand Partisan eligibility and immediately place one Partisan marker."
	},
	"event.log.partisan_nations": {
		"params": [],
		"zh-CN": "苏联、希腊、阿尔巴尼亚和南斯拉夫现可放置游击队标记。",
		"en": "Partisan markers may now be placed in the Soviet Union, Greece, Albania, and Yugoslavia."
	},
	"event.log.partisan_remove": {
		"params": [
			"space"
		],
		"zh-CN": "移除{space}的游击队标记。",
		"en": "Remove the Partisan marker from {space}."
	},
	"event.log.partisan_remove_up_to_two": {
		"params": [],
		"zh-CN": "必须移除至多两个现有游击队标记。",
		"en": "Remove up to two existing Partisan markers."
	},
	"event.log.patton": {
		"params": [],
		"zh-CN": "巴顿：美国第3集团军完成首次攻击后，可在常规战斗结束时再攻击一次；第二次战斗最多推进两格。",
		"en": "Patton: after the US 3rd Army completes its first attack, it may attack again after regular combat; the second combat may advance at most two spaces."
	},
	"event.log.people_army": {
		"params": [],
		"zh-CN": "选择一个有游击队且无轴心单位的南斯拉夫空间部署人民军。",
		"en": "Choose a Yugoslav space with Partisans and no Axis units in which to deploy the People's Army."
	},
	"event.log.reinforcement_reserve": {
		"params": [
			"card",
			"side"
		],
		"zh-CN": "{card}增援进入{side}预备箱。",
		"en": "{card} reinforcements enter the {side} Reserve Box."
	},
	"event.log.removed_and_flipped": {
		"params": [
			"pieces",
			"spaces",
			"reserve"
		],
		"zh-CN": "移除{pieces}个该国单位，翻转{spaces}个无轴心驻军空间{reserve}。",
		"en": "Remove {pieces} national units and flip {spaces} spaces without Axis units{reserve}."
	},
	"event.log.revenge_weapon": {
		"params": [
			"vp"
		],
		"zh-CN": "报复武器：VP+1，当前 {vp}。",
		"en": "Vergeltungs-Waffe: VP +1, now {vp}."
	},
	"event.log.skorzeny": {
		"params": [
			"vp"
		],
		"zh-CN": "斯科尔兹内：VP+1，当前 {vp}。",
		"en": "Skorzeny: VP +1, now {vp}."
	},
	"event.log.sorge_markers": {
		"params": [],
		"zh-CN": "可在至多两个含苏军的格放置移动或战斗标记。",
		"en": "Place Move or Combat markers in up to two spaces containing Soviet units."
	},
	"event.log.soviet_attack": {
		"params": [],
		"zh-CN": "本行动轮纯苏军攻击获得+1 DRM。",
		"en": "All-Soviet attacks receive +1 DRM this Action Round."
	},
	"event.log.soviet_attack_no_retreat": {
		"params": [],
		"zh-CN": "本行动轮纯苏军攻击获得+1 DRM，轴心国不得使用不退却。",
		"en": "All-Soviet attacks receive +1 DRM this Action Round, and the Axis may not use No Retreat."
	},
	"event.log.soviet_orders_cancelled": {
		"params": [
			"removed"
		],
		"zh-CN": "本回合苏军命令及其处罚取消{removed}。",
		"en": "Soviet Orders and their penalty are cancelled for this turn{removed}."
	},
	"event.log.soviet_tank_delay": {
		"params": [],
		"zh-CN": "四回合后可打出苏军坦克集团军增援，八回合后盟军手牌上限增加1。",
		"en": "Soviet Tank Army reinforcements become playable four turns later; the Allied hand limit increases by one eight turns later."
	},
	"event.log.speer": {
		"params": [],
		"zh-CN": "『施佩尔』生效：现在可以打出德国第35、36号增援及最终生产激增事件。",
		"en": "Speer is in effect: German Reinforcements 35 and 36 and Final Production Surge may now be played."
	},
	"event.log.strangle": {
		"params": [],
		"zh-CN": "绞杀行动：法国境内轴心单位此后处于有限补给，轴心国不得在法国进行战略调动。",
		"en": "Operation Strangle: Axis units in France are now in Limited Supply, and the Axis may not use Strategic Redeployment in France."
	},
	"event.log.stuka": {
		"params": [],
		"zh-CN": "斯图卡生效：本行动轮纯德军对苏军的攻击 +1 DRM。",
		"en": "Stuka is in effect: all-German attacks against Soviet units receive +1 DRM this Action Round."
	},
	"event.log.taifun": {
		"params": [
			"penalty"
		],
		"zh-CN": "台风行动生效：放置 4 个战斗标记，本行动轮轴心国对苏军攻击 +1 DRM，并可攻击莫斯科{penalty}",
		"en": "Taifun is in effect: place four Combat markers; Axis attacks against Soviet units receive +1 DRM this Action Round, and Moscow may be attacked{penalty}"
	},
	"event.log.three_power_conference": {
		"params": [
			"vp"
		],
		"zh-CN": "三巨头会议：轴心国VP-1，当前{vp}。",
		"en": "Three Power Conference: Axis VP -1, now {vp}."
	},
	"event.log.totaler_krieg": {
		"params": [
			"bonus"
		],
		"zh-CN": "总体战生效：轴心国此后不能自动胜利；德军装甲补充上限从下一回合起提高至 3{bonus}。",
		"en": "Totaler Krieg is in effect: the Axis may no longer win an Automatic Victory; the German Panzer replacement limit rises to three beginning next turn{bonus}."
	},
	"event.log.us_entry": {
		"params": [
			"turn"
		],
		"zh-CN": "美国于第{turn}回合加入盟军。",
		"en": "The United States joins the Allies in Turn {turn}."
	},
	"event.log.us_events_enabled": {
		"params": [],
		"zh-CN": "现在可以打出盟军登陆、美国第8航空队和美国增援事件。",
		"en": "Allied invasions, US 8th Air Force, and US reinforcement events may now be played."
	},
	"event.log.vp_plus_one": {
		"params": [
			"vp"
		],
		"zh-CN": "轴心国VP+1，当前{vp}。",
		"en": "Axis VP +1, now {vp}."
	},
	"event.log.wacht_am_rhein": {
		"params": [],
		"zh-CN": "守望莱茵：放置4个战斗标记；本行动轮德国第5装甲集团军或第6党卫军装甲集团军参加对非苏军的攻击时+2 DRM。",
		"en": "Wacht am Rhein: place four Combat markers; attacks against non-Soviet units involving the German 5th Panzer Army or 6th SS Panzer Army receive +2 DRM this Action Round."
	},
	"event.log.wolfpacks": {
		"params": [],
		"zh-CN": "狼群：盟军在下一抽牌阶段的手牌上限减少2。",
		"en": "Wolfpacks: the Allied hand limit is reduced by two in the next Draw Strategy Phase."
	},
	"event.log.yalta": {
		"params": [
			"vp"
		],
		"zh-CN": "雅尔塔会议：轴心国VP-1，当前{vp}；本行动轮轴心国不得对含美军的攻击使用不撤退。",
		"en": "Yalta Conference: Axis VP -1, now {vp}; the Axis may not use No Retreat against attacks containing US units this Action Round."
	},
	"event.log.zitadelle": {
		"params": [],
		"zh-CN": "堡垒行动：放置2个战斗标记；本行动轮苏军防御射击+2 DRM。德国装甲集团军若推进占领原有至少2个LCU的苏联空间则VP+1，否则VP-1。",
		"en": "Zitadelle: place two Combat markers; Soviet defensive fire receives +2 DRM this Action Round. Gain 1 VP if a German Panzer army advances into a Soviet space that originally contained at least two LCUs; otherwise lose 1 VP."
	},
	"event.log.zitadelle_result": {
		"params": [
			"result",
			"delta",
			"vp"
		],
		"zh-CN": "堡垒行动{result}：VP{delta}，当前{vp}。",
		"en": "Zitadelle {result}: VP {delta}, now {vp}."
	},
	"event.panzergruppe_guderian.play": {
		"params": [],
		"zh-CN": "古德里安装甲集群：德国第2装甲集团军完成首次攻击后，可在全部常规战斗结束时再攻击一次；第二次战斗最多推进一格。",
		"en": "Panzergruppe Guderian: after the German 2nd Panzer Army completes its first attack, it may attack again after all regular combats; its second combat may advance at most one space."
	},
	"event.patton.play": {
		"params": [],
		"zh-CN": "巴顿：美国第3集团军完成首次攻击后，可在常规战斗结束时再攻击一次；第二次战斗最多推进两格。",
		"en": "Patton: after the US 3rd Army completes its first attack, it may attack again after regular combat; its second combat may advance at most two spaces."
	},
	"event.wacht_am_rhein.play": {
		"params": [],
		"zh-CN": "守望莱茵：放置4个战斗标记；本行动轮德国第5装甲集团军或第6党卫军装甲集团军参加对非苏军的攻击时+2 DRM。",
		"en": "Wacht am Rhein: place four combat markers; during this action round, attacks against non-Soviet units receive +2 DRM when the German 5th Panzer Army or 6th SS Panzer Army participates."
	},
	"event.zitadelle.play": {
		"params": [],
		"zh-CN": "堡垒行动：放置2个战斗标记；本行动轮苏军防御射击+2 DRM。德国装甲集团军若推进占领原有至少2个LCU的苏联空间则VP+1，否则VP-1。",
		"en": "Fall Zitadelle: place two combat markers; Soviet defensive fire receives +2 DRM this action round. Gain 1 VP if a German Panzer Army advances into a Soviet space that began with at least two LCUs; otherwise lose 1 VP."
	},
	"event.zitadelle.result": {
		"params": [
			"outcome",
			"delta",
			"vp"
		],
		"zh-CN": "堡垒行动{outcome}：VP{delta}，当前{vp}。",
		"en": "Fall Zitadelle {outcome}: VP {delta}; now {vp}."
	},
	"events.air_supply.space": {
		"params": [],
		"zh-CN": "空军补给：选择一个含断补轴心单位的空间。",
		"en": "Luftwaffe Supply: choose a space containing out-of-supply Axis units."
	},
	"events.atlantic_wall.select": {
		"params": [
			"count"
		],
		"zh-CN": "大西洋壁垒：选择 2 个空间（{count}/2）。",
		"en": "Atlantic Wall: choose two spaces ({count}/2)."
	},
	"events.banzai.select": {
		"params": [
			"count"
		],
		"zh-CN": "万岁冲锋：依次从地图、预备箱、已消灭单位池选择英联邦军（{count}/2）。",
		"en": "Banzai: choose Commonwealth corps in order from the map, Reserve Box, and Eliminated Units Box ({count}/2)."
	},
	"events.combat_markers.place": {
		"params": [
			"remaining"
		],
		"zh-CN": "放置战斗标记（剩余 {remaining}）。",
		"en": "Place Combat markers ({remaining} remaining)."
	},
	"events.east_wall.select": {
		"params": [
			"count"
		],
		"zh-CN": "东方壁垒：选择 3 个空间（{count}/3）。",
		"en": "East Wall: choose three spaces ({count}/3)."
	},
	"events.final_production.select": {
		"params": [
			"count"
		],
		"zh-CN": "最后生产冲刺：选择 3 个减员德国装甲集团军（{count}/3）。",
		"en": "Final Production Surge: choose three reduced German Panzer armies ({count}/3)."
	},
	"events.front.replace": {
		"params": [
			"label"
		],
		"zh-CN": "选择满编 3-3-3 苏军方面军，由{label}替换。",
		"en": "Choose a full-strength 3-3-3 Soviet Front to be replaced by {label}."
	},
	"events.german_reinforcement.transfer": {
		"params": [],
		"zh-CN": "『德国增援』：选择一支在利比亚或埃及且有补给的德国装甲军调回预备箱。",
		"en": "German Reinforcements: choose a supplied German Panzer corps in Libya or Egypt to return to the Reserve Box."
	},
	"events.hedgehogs.select": {
		"params": [
			"count"
		],
		"zh-CN": "刺猬阵地：选择 3 个空间（{count}/3）。",
		"en": "Hedgehogs: choose three spaces ({count}/3)."
	},
	"events.invasion.advance": {
		"params": [],
		"zh-CN": "选择登陆推进单位。",
		"en": "Choose invasion advance units."
	},
	"events.invasion.beach": {
		"params": [
			"event",
			"marker"
		],
		"zh-CN": "『{event}』：选择{marker}登陆滩。",
		"en": "{event}: choose the {marker} invasion beach."
	},
	"events.invasion.mode": {
		"params": [
			"event"
		],
		"zh-CN": "『{event}』：选择一个盟军滩头或两个国别滩头。",
		"en": "{event}: choose one Allied beachhead or two national beachheads."
	},
	"events.log.air_supply_placed": {
		"params": [
			"space"
		],
		"zh-CN": "空军补给标记放置在{space}；其中轴心单位本回合防御与损耗时视为有限补给。",
		"en": "Place the Luftwaffe Supply marker in {space}; Axis units there are treated as in Limited Supply for defense and Attrition this turn."
	},
	"events.log.reinforcement_deployed": {
		"params": [
			"side",
			"piece",
			"space"
		],
		"zh-CN": "{side}将{piece}部署至{space}。",
		"en": "{side} deploys {piece} to {space}."
	},
	"events.log.reinforcement_yellow_event": {
		"params": [
			"card",
			"ops"
		],
		"zh-CN": "{card}的安特卫普增援改作黄色事件，获得 {ops} OPS；不放置免费激活标记。",
		"en": "{card}'s Antwerp reinforcement is treated as a Yellow Event for {ops} OPS; no free activation marker is placed."
	},
	"events.marker.choose": {
		"params": [
			"space"
		],
		"zh-CN": "为{space}选择激活标记。",
		"en": "Choose an activation marker for {space}."
	},
	"events.marker.optional": {
		"params": [],
		"zh-CN": "可放置一个移动或战斗标记。",
		"en": "You may place one Move or Combat marker."
	},
	"events.marker.space_choose": {
		"params": [
			"space"
		],
		"zh-CN": "{space}：选择激活标记。",
		"en": "{space}: choose an activation marker."
	},
	"events.panzer_refit.select": {
		"params": [
			"count"
		],
		"zh-CN": "装甲部队整补：选择 3 个有补给的减员德国装甲单位（{count}/3）。",
		"en": "Panzer Refit: choose three supplied reduced German Panzer units ({count}/3)."
	},
	"events.partisan_sweep.complete": {
		"params": [],
		"zh-CN": "『反游击队扫荡』完成。",
		"en": "Anti-Partisan Sweep is complete."
	},
	"events.partisan_sweep.remove": {
		"params": [
			"remaining"
		],
		"zh-CN": "『反游击队扫荡』：移除游击队（剩余 {remaining}）。",
		"en": "Anti-Partisan Sweep: remove Partisans ({remaining} remaining)."
	},
	"events.reinforcement.antwerp_1945_choice": {
		"params": [
			"space",
			"ops"
		],
		"zh-CN": "{space}：选择免费激活标记或 {ops} OPS。",
		"en": "{space}: choose a free activation marker or {ops} OPS."
	},
	"events.reinforcement.deploy_desert": {
		"params": [
			"unit"
		],
		"zh-CN": "部署{unit}（亚历山大、开罗或巴士拉）。",
		"en": "Deploy {unit} in Alexandria, Cairo, or Basra."
	},
	"events.reinforcement.deploy_standard": {
		"params": [
			"unit"
		],
		"zh-CN": "部署{unit}（本国完整补给城市或补给源）。",
		"en": "Deploy {unit} in a friendly full-supply city or supply source."
	},
	"events.reinforcement.deploy_western": {
		"params": [
			"unit"
		],
		"zh-CN": "部署{unit}（本国入口、港口或可用滩头）。",
		"en": "Deploy {unit} at a national entry space, port, or available beachhead."
	},
	"events.reserve.transfer_army": {
		"params": [],
		"zh-CN": "将英国第8集团军或美国第7集团军移入预备箱。",
		"en": "Move the British 8th Army or US 7th Army to the Reserve Box."
	},
	"events.sorge.place": {
		"params": [
			"remaining"
		],
		"zh-CN": "『佐尔格』：放置激活标记（剩余 {remaining}）。",
		"en": "Sorge: place activation markers ({remaining} remaining)."
	},
	"events.tito.complete": {
		"params": [],
		"zh-CN": "『铁托』部署完成。",
		"en": "Tito deployment is complete."
	},
	"events.tito.space": {
		"params": [],
		"zh-CN": "『铁托』：选择南斯拉夫部署空间。",
		"en": "Tito: choose a Yugoslav deployment space."
	},
	"events.transfer.deploy_neutral": {
		"params": [
			"country",
			"piece"
		],
		"zh-CN": "部署{country}单位：{piece}。",
		"en": "Deploy a {country} unit: {piece}."
	},
	"info.cards.card_alt": {
		"params": [
			"side",
			"num",
			"name"
		],
		"zh-CN": "{side}第{num}号牌 {name}",
		"en": "{side} card {num}: {name}"
	},
	"info.cards.document_side_title": {
		"params": [
			"side"
		],
		"zh-CN": "BTB {side}牌组",
		"en": "BTB {side} Deck"
	},
	"info.cards.document_title": {
		"params": [],
		"zh-CN": "BTB 牌组",
		"en": "BTB Decks"
	},
	"info.cards.english_cards": {
		"params": [],
		"zh-CN": "英文卡牌",
		"en": "English cards"
	},
	"info.cards.side_title": {
		"params": [
			"side"
		],
		"zh-CN": "{side}牌组",
		"en": "{side} Deck"
	},
	"info.cards.title": {
		"params": [],
		"zh-CN": "牌组",
		"en": "Decks"
	},
	"info.charts.combat_alt": {
		"params": [],
		"zh-CN": "BTB 战斗图表",
		"en": "BTB combat charts"
	},
	"info.charts.document_title": {
		"params": [],
		"zh-CN": "BTB 辅助图表",
		"en": "BTB Player Aid Charts"
	},
	"info.charts.intro": {
		"params": [],
		"zh-CN": "战斗、地形、补给、替补和回合流程的官方辅助图表。",
		"en": "Official player aids for combat, terrain, supply, replacements, and the turn sequence."
	},
	"info.charts.other_alt": {
		"params": [],
		"zh-CN": "BTB 其他辅助图表",
		"en": "Other BTB player aid charts"
	},
	"info.charts.title": {
		"params": [],
		"zh-CN": "辅助图表",
		"en": "Player Aid Charts"
	},
	"info.nation.br": {
		"params": [],
		"zh-CN": "英国",
		"en": "Britain"
	},
	"info.nation.bu": {
		"params": [],
		"zh-CN": "保加利亚",
		"en": "Bulgaria"
	},
	"info.nation.cw": {
		"params": [],
		"zh-CN": "英联邦",
		"en": "Commonwealth"
	},
	"info.nation.ff": {
		"params": [],
		"zh-CN": "自由法国",
		"en": "Free France"
	},
	"info.nation.ge": {
		"params": [],
		"zh-CN": "德国",
		"en": "Germany"
	},
	"info.nation.hu": {
		"params": [],
		"zh-CN": "匈牙利",
		"en": "Hungary"
	},
	"info.nation.it": {
		"params": [],
		"zh-CN": "意大利",
		"en": "Italy"
	},
	"info.nation.ro": {
		"params": [],
		"zh-CN": "罗马尼亚",
		"en": "Romania"
	},
	"info.nation.su": {
		"params": [],
		"zh-CN": "苏联",
		"en": "Soviet Union"
	},
	"info.nation.sw": {
		"params": [],
		"zh-CN": "瑞典",
		"en": "Sweden"
	},
	"info.nation.tu": {
		"params": [],
		"zh-CN": "土耳其",
		"en": "Turkey"
	},
	"info.nation.us": {
		"params": [],
		"zh-CN": "美国",
		"en": "United States"
	},
	"info.nation.yu": {
		"params": [],
		"zh-CN": "南斯拉夫",
		"en": "Yugoslavia"
	},
	"info.nav.cards": {
		"params": [],
		"zh-CN": "牌组",
		"en": "Decks"
	},
	"info.nav.charts": {
		"params": [],
		"zh-CN": "图表",
		"en": "Charts"
	},
	"info.nav.pieces": {
		"params": [],
		"zh-CN": "算子",
		"en": "Units"
	},
	"info.nav.rulebook": {
		"params": [],
		"zh-CN": "规则书",
		"en": "Rulebook"
	},
	"info.pieces.document_title": {
		"params": [],
		"zh-CN": "BTB 算子图鉴",
		"en": "BTB Unit Reference"
	},
	"info.pieces.full_alt": {
		"params": [
			"name"
		],
		"zh-CN": "{name}满编面",
		"en": "{name} full-strength side"
	},
	"info.pieces.heading": {
		"params": [
			"nation",
			"side"
		],
		"zh-CN": "{nation} · {side}",
		"en": "{nation} · {side}"
	},
	"info.pieces.marker": {
		"params": [],
		"zh-CN": "游戏标记",
		"en": "Game marker"
	},
	"info.pieces.neutral": {
		"params": [],
		"zh-CN": "中立国",
		"en": "Neutral"
	},
	"info.pieces.reduced_alt": {
		"params": [
			"name"
		],
		"zh-CN": "{name}减损面",
		"en": "{name} reduced side"
	},
	"info.pieces.stats": {
		"params": [
			"cf",
			"lf",
			"mf",
			"rcf",
			"rlf",
			"rmf"
		],
		"zh-CN": "满编 {cf}-{lf}-{mf} · 减损 {rcf}-{rlf}-{rmf}",
		"en": "Full {cf}-{lf}-{mf} · Reduced {rcf}-{rlf}-{rmf}"
	},
	"info.pieces.title": {
		"params": [],
		"zh-CN": "算子图鉴",
		"en": "Unit Reference"
	},
	"invasions.log.beachhead_created": {
		"params": [
			"event",
			"space",
			"marker",
			"count"
		],
		"zh-CN": "『{event}』在{space}建立{marker}滩头并投入{count}个单位。",
		"en": "{event} establishes a {marker} beachhead at {space} and lands {count} units."
	},
	"invasions.log.beachhead_removed": {
		"params": [
			"space",
			"reason"
		],
		"zh-CN": "{space}滩头{reason}，移除滩头标记。",
		"en": "The beachhead at {space} {reason}; remove its marker."
	},
	"invasions.log.declared_complete": {
		"params": [],
		"zh-CN": "盟军宣布本局不再进行登陆；剩余可转换登陆牌此后可作为普通增援事件使用。",
		"en": "The Allies declare that no further invasions will be made; remaining convertible invasion cards may now be used as ordinary reinforcement events."
	},
	"invasions.log.deploy": {
		"params": [],
		"zh-CN": "按普通增援流程部署登陆部队。",
		"en": "Deploy the invasion units using the normal reinforcement procedure."
	},
	"invasions.log.pacific": {
		"params": [
			"pieces"
		],
		"zh-CN": "{pieces}由预备箱调往太平洋战区并移出游戏。",
		"en": "{pieces} move from the Reserve Box to the Pacific theater and are removed from the game."
	},
	"invasions.log.reserve_return": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}在盟军行动结束后进入盟军预备箱，并恢复为满编。",
		"en": "{piece} enters the Allied Reserve Box at the end of the Allied action and returns to full strength."
	},
	"map.log.control_vp": {
		"params": [
			"space",
			"delta",
			"vp"
		],
		"zh-CN": "{space}控制权改变：轴心国VP{delta}，当前{vp}。",
		"en": "{space} changes control: Axis VP {delta}; now {vp}."
	},
	"neutrals.log.declare_war": {
		"params": [
			"side",
			"country"
		],
		"zh-CN": "{side}向{country}宣战。",
		"en": "{side} declares war on {country}."
	},
	"neutrals.log.declare_war_penalty": {
		"params": [
			"country",
			"penalty",
			"vp"
		],
		"zh-CN": "轴心国向{country}宣战：VP-{penalty}，当前{vp}。",
		"en": "The Axis declares war on {country}: VP -{penalty}, now {vp}."
	},
	"neutrals.log.deployment": {
		"params": [
			"country",
			"piece",
			"space"
		],
		"zh-CN": "{country}将{piece}部署至{space}。",
		"en": "{country} deploys {piece} to {space}."
	},
	"neutrals.log.turkey_rp": {
		"params": [
			"side"
		],
		"zh-CN": "土耳其获得本回合固定2点补充点，由{side}使用。",
		"en": "Turkey receives a fixed 2 RP this turn, spent by {side}."
	},
	"neutrals.log.vichy": {
		"params": [],
		"zh-CN": "维希法国参战；双方此后可进入维希法国及法属北非。",
		"en": "Vichy France enters the war; both sides may now enter Vichy France and French North Africa."
	},
	"replacements.log.rebuild": {
		"params": [
			"side",
			"piece",
			"location"
		],
		"zh-CN": "{side}重建{piece}至{location}。",
		"en": "{side} rebuilds {piece} in {location}."
	},
	"replacements.log.restore": {
		"params": [
			"side",
			"piece",
			"location"
		],
		"zh-CN": "{side}补足{piece}于{location}。",
		"en": "{side} restores {piece} to full strength in {location}."
	},
	"replacements.log.voluntary_elimination": {
		"params": [
			"piece",
			"turn"
		],
		"zh-CN": "盟军自愿消灭{piece}；该单位将在 Turn {turn} 进入被消灭区。",
		"en": "The Allies voluntarily eliminate {piece}; it enters the Eliminated Units Box in Turn {turn}."
	},
	"replacements.log.wehrkreis": {
		"params": [
			"count",
			"points"
		],
		"zh-CN": "德国军区惩罚：{count} 个军区失控和/或断补，德国补充点减少 {points}。",
		"en": "Wehrkreis penalty: {count} districts are uncontrolled and/or out of supply; German RP is reduced by {points}."
	},
	"stalin.log.captured": {
		"params": [
			"space",
			"reason",
			"vp"
		],
		"zh-CN": "斯大林在{space}{reason}：VP+4，当前{vp}。",
		"en": "Stalin is {reason} at {space}: VP +4, now {vp}."
	},
	"stalin.log.sr": {
		"params": [
			"origin",
			"destination"
		],
		"zh-CN": "斯大林由{origin}战略调动至{destination}。",
		"en": "Stalin strategically redeploys from {origin} to {destination}."
	},
	"turn.attrition.allied": {
		"params": [],
		"zh-CN": "结算盟军损耗。",
		"en": "Resolve Allied Attrition."
	},
	"turn.attrition.axis": {
		"params": [],
		"zh-CN": "结算轴心国损耗。",
		"en": "Resolve Axis Attrition."
	},
	"turn.cards.blitz": {
		"params": [],
		"zh-CN": "选择一张闪击战牌，或跳过。",
		"en": "Choose a Blitzkrieg card, or skip."
	},
	"turn.cards.discard": {
		"params": [
			"note"
		],
		"zh-CN": "弃牌至手牌上限{note}。",
		"en": "Discard down to the hand limit{note}."
	},
	"turn.cards.total_war": {
		"params": [],
		"zh-CN": "将『总体战！』加入手牌，或跳过。",
		"en": "Add Total War! to your hand, or skip."
	},
	"turn.collaboration.acknowledge": {
		"params": [
			"spaces"
		],
		"zh-CN": "确认收到补给警告：{spaces}。",
		"en": "Acknowledge supply warnings: {spaces}."
	},
	"turn.collaboration.flag": {
		"params": [
			"count"
		],
		"zh-CN": "标记补给警告（{count}）。",
		"en": "Flag supply warnings ({count})."
	},
	"turn.collaboration.rollback": {
		"params": [
			"proposer",
			"name"
		],
		"zh-CN": "{proposer} 提议回滚到：{name}。",
		"en": "{proposer} proposes rolling back to: {name}."
	},
	"turn.draw.exchange": {
		"params": [],
		"zh-CN": "弃一张 3+ OPS 牌，换取盟军第24号牌。",
		"en": "Discard a 3+ OPS card to receive Allied card 24."
	},
	"turn.draw.redraw": {
		"params": [],
		"zh-CN": "保留一张牌并重抽，或重抽全部手牌。",
		"en": "Keep one card and redraw, or redraw the entire hand."
	},
	"turn.eliminated_theater": {
		"params": [
			"piece"
		],
		"zh-CN": "为 {piece} 选择被消灭战区。",
		"en": "Choose an eliminated theater for {piece}."
	},
	"turn.game_over": {
		"params": [
			"result"
		],
		"zh-CN": "{result}",
		"en": "{result}"
	},
	"turn.log.action_phase": {
		"params": [],
		"zh-CN": "行动阶段",
		"en": "Action Phase"
	},
	"turn.log.action_round": {
		"params": [
			"turn",
			"round"
		],
		"zh-CN": "Turn {turn} -- 行动轮 {round}",
		"en": "Turn {turn} -- Action Round {round}"
	},
	"turn.log.attrition_control": {
		"params": [
			"space",
			"side"
		],
		"zh-CN": "{space}因断补转为{side}控制",
		"en": "{space} changes to {side} control (OOS)"
	},
	"turn.log.attrition_eliminated": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}被消灭（断补）",
		"en": "{piece} is eliminated (OOS)"
	},
	"turn.log.attrition_released": {
		"params": [
			"piece"
		],
		"zh-CN": "{piece}返回已消灭单位池",
		"en": "{piece} returns to the Eliminated Units Box"
	},
	"turn.log.card_added": {
		"params": [
			"side",
			"card"
		],
		"zh-CN": "{side}将{card}加入初次总体战手牌。",
		"en": "{side} adds {card} to its initial Total War hand."
	},
	"turn.log.deck_transition": {
		"params": [],
		"zh-CN": "双方总体战牌、弃牌与未抽取的闪击战牌已分别洗入新牌堆。",
		"en": "Each side shuffles its Total War cards, discards, and undrawn Blitzkrieg cards into a new deck."
	},
	"turn.log.eliminated_theater": {
		"params": [
			"piece",
			"theater"
		],
		"zh-CN": "{piece}记入{theater}战区被消灭区。",
		"en": "Record {piece} in the {theater} Eliminated Units Box."
	},
	"turn.log.mandated_offensive_failed": {
		"params": [
			"side"
		],
		"zh-CN": "{side}未完成强制攻势：VP惩罚1点。",
		"en": "{side} fails its Mandated Offensive: 1 VP penalty."
	},
	"turn.log.no_replacement": {
		"params": [
			"side"
		],
		"zh-CN": "{side}没有合法补充消费，自动结束补充阶段。",
		"en": "{side} has no legal replacement expenditure; end the Replacement Phase automatically."
	},
	"turn.log.order_roll": {
		"params": [
			"side",
			"die",
			"result"
		],
		"zh-CN": "{side}：{die} → {result}",
		"en": "{side}: {die} → {result}"
	},
	"turn.log.place_initial_orders": {
		"params": [],
		"zh-CN": "第一回合：轴心国放置三个斯大林命令坚守标记。",
		"en": "Turn 1: the Axis places three Stalin Orders Stand Fast markers."
	},
	"turn.log.winter_pass": {
		"params": [
			"turn_name",
			"required"
		],
		"zh-CN": "{turn_name}结束：轴心国满足冬季{required}个计分格要求。",
		"en": "End of {turn_name}: the Axis satisfies the Winter requirement of {required} VP spaces."
	},
	"turn.log.winter_penalty": {
		"params": [
			"turn_name",
			"controlled",
			"penalty",
			"vp"
		],
		"zh-CN": "{turn_name}结束：轴心国在苏联、埃及和伊拉克仅控制{controlled}个计分格，VP-{penalty}，当前{vp}。",
		"en": "End of {turn_name}: the Axis controls only {controlled} VP spaces in the Soviet Union, Egypt, and Iraq; VP -{penalty}, now {vp}."
	},
	"turn.opening.choose": {
		"params": [],
		"zh-CN": "选择开局事件。",
		"en": "Choose the opening event."
	},
	"turn.opening.play": {
		"params": [],
		"zh-CN": "打出开局事件。",
		"en": "Play the opening event."
	},
	"turn.orders.place": {
		"params": [
			"leader",
			"count"
		],
		"zh-CN": "放置{leader}坚守标记（{count}/3）。",
		"en": "Place {leader} Stand Fast markers ({count}/3)."
	},
	"turn.orders.place_stalin": {
		"params": [
			"count"
		],
		"zh-CN": "放置斯大林坚守标记（{count}/3）。",
		"en": "Place Stalin Stand Fast markers ({count}/3)."
	},
	"turn.orders.roll_allied": {
		"params": [],
		"zh-CN": "掷盟军命令骰。",
		"en": "Roll the Allied Orders die."
	},
	"turn.orders.roll_axis": {
		"params": [],
		"zh-CN": "掷轴心国命令骰。",
		"en": "Roll the Axis Orders die."
	},
	"turn.phase.attrition": {
		"params": [],
		"zh-CN": "损耗阶段",
		"en": "Attrition Phase"
	},
	"turn.phase.draw": {
		"params": [],
		"zh-CN": "抽牌阶段",
		"en": "Draw Strategy Phase"
	},
	"turn.phase.replacement": {
		"params": [],
		"zh-CN": "补充阶段",
		"en": "Replacement Phase"
	},
	"turn.phase.turn_heading": {
		"params": [
			"turn",
			"name"
		],
		"zh-CN": "Turn {turn}：{name}",
		"en": "Turn {turn}: {name}"
	},
	"turn.replacement.allied": {
		"params": [],
		"zh-CN": "使用盟军补充点。",
		"en": "Spend Allied Replacement Points."
	},
	"turn.replacement.axis": {
		"params": [],
		"zh-CN": "使用轴心国补充点。",
		"en": "Spend Axis Replacement Points."
	},
	"turn.replacement.location": {
		"params": [],
		"zh-CN": "选择重建位置。",
		"en": "Choose a rebuild location."
	},
	"turn.setup.deploy_armies": {
		"params": [],
		"zh-CN": "部署德国第1与第7集团军（分处两个占领法国空间）。",
		"en": "Deploy the German 1st and 7th Armies in separate Occupied France spaces."
	},
	"turn.setup.place_stalin": {
		"params": [
			"count"
		],
		"zh-CN": "放置斯大林坚守标记（{count}/3）。",
		"en": "Place Stalin Stand Fast markers ({count}/3)."
	},
	"turn.trench.remove_allied": {
		"params": [],
		"zh-CN": "移除滩头或己方堑壕。",
		"en": "Remove a beachhead or a friendly trench."
	},
	"turn.trench.remove_axis": {
		"params": [],
		"zh-CN": "移除己方堑壕。",
		"en": "Remove a friendly trench."
	},
	"turn.victory.allied_automatic": {
		"params": [],
		"zh-CN": "盟军自动胜利",
		"en": "Allied Automatic Victory"
	},
	"turn.victory.allied_german_supply": {
		"params": [],
		"zh-CN": "盟军控制德国全部轴心补给源，获得自动胜利",
		"en": "The Allies control every Axis supply source in Germany and win an Automatic Victory"
	},
	"turn.victory.axis_automatic": {
		"params": [],
		"zh-CN": "轴心国自动胜利",
		"en": "Axis Automatic Victory"
	},
	"turn.victory.axis_campaign": {
		"params": [],
		"zh-CN": "轴心国Campaign胜利",
		"en": "Axis Campaign Victory"
	},
	"turn.victory.resigned": {
		"params": [
			"role"
		],
		"zh-CN": "{role}认输。",
		"en": "{role} resigned."
	},
	"turn.voluntary_elimination": {
		"params": [],
		"zh-CN": "盟军可自愿消灭一个完整补给的英、美或自由法国集团军；可重复选择或结束。",
		"en": "The Allies may voluntarily eliminate a fully supplied British, US, or Free French army; choose repeatedly or finish."
	},
	"ui.accept": {
		"params": [],
		"zh-CN": "接受",
		"en": "Accept"
	},
	"ui.action_track.allied_invasion": {
		"params": [],
		"zh-CN": "盟军登陆",
		"en": "Allied Invasion"
	},
	"ui.action_track.axis_reinf": {
		"params": [],
		"zh-CN": "轴心国增援",
		"en": "Axis Reinforcement"
	},
	"ui.action_track.br_reinf": {
		"params": [],
		"zh-CN": "英军增援",
		"en": "British Reinforcement"
	},
	"ui.action_track.ge_reinf": {
		"params": [],
		"zh-CN": "德军增援",
		"en": "German Reinforcement"
	},
	"ui.action_track.one_ops": {
		"params": [],
		"zh-CN": "1 OPS",
		"en": "1 OPS"
	},
	"ui.action_track.ops": {
		"params": [],
		"zh-CN": "行动点",
		"en": "OPS"
	},
	"ui.action_track.other_event": {
		"params": [],
		"zh-CN": "其他事件",
		"en": "Other Event"
	},
	"ui.action_track.partisans": {
		"params": [],
		"zh-CN": "游击队",
		"en": "Partisans"
	},
	"ui.action_track.rp": {
		"params": [],
		"zh-CN": "补员",
		"en": "RP"
	},
	"ui.action_track.sr": {
		"params": [],
		"zh-CN": "战略调动",
		"en": "SR"
	},
	"ui.action_track.su_reinf": {
		"params": [],
		"zh-CN": "苏军增援",
		"en": "Soviet Reinforcement"
	},
	"ui.action_track.usa_reinf": {
		"params": [],
		"zh-CN": "美军增援",
		"en": "US Reinforcement"
	},
	"ui.action.accept_rollback": {
		"params": [],
		"zh-CN": "接受回滚",
		"en": "Accept rollback"
	},
	"ui.action.activate": {
		"params": [],
		"zh-CN": "发动",
		"en": "Activate"
	},
	"ui.action.auto_ops": {
		"params": [],
		"zh-CN": "自动 1 OPS",
		"en": "Automatic 1 OPS"
	},
	"ui.action.back": {
		"params": [],
		"zh-CN": "返回",
		"en": "Back"
	},
	"ui.action.back_to_selection": {
		"params": [],
		"zh-CN": "返回选择",
		"en": "Back to selection"
	},
	"ui.action.cancel": {
		"params": [],
		"zh-CN": "取消",
		"en": "Cancel"
	},
	"ui.action.cancel_selection": {
		"params": [],
		"zh-CN": "取消选择",
		"en": "Cancel selection"
	},
	"ui.action.combat_marker": {
		"params": [],
		"zh-CN": "放置战斗标记",
		"en": "Place combat marker"
	},
	"ui.action.confirm": {
		"params": [],
		"zh-CN": "确认",
		"en": "Confirm"
	},
	"ui.action.confirm_attack": {
		"params": [],
		"zh-CN": "确认进攻",
		"en": "Confirm attack"
	},
	"ui.action.confirm_removal": {
		"params": [],
		"zh-CN": "确认移除",
		"en": "Confirm removal"
	},
	"ui.action.continue": {
		"params": [],
		"zh-CN": "继续",
		"en": "Continue"
	},
	"ui.action.declare_sweden": {
		"params": [],
		"zh-CN": "向瑞典宣战",
		"en": "Declare war on Sweden"
	},
	"ui.action.declare_turkey": {
		"params": [],
		"zh-CN": "向土耳其宣战",
		"en": "Declare war on Turkey"
	},
	"ui.action.discard_all": {
		"params": [],
		"zh-CN": "全部弃掉并重抽",
		"en": "Discard all and redraw"
	},
	"ui.action.done": {
		"params": [],
		"zh-CN": "完成",
		"en": "Done"
	},
	"ui.action.double_beachheads": {
		"params": [],
		"zh-CN": "两个国别滩头",
		"en": "Two national beachheads"
	},
	"ui.action.end_action": {
		"params": [],
		"zh-CN": "结束行动",
		"en": "End action"
	},
	"ui.action.end_advance": {
		"params": [],
		"zh-CN": "结束推进",
		"en": "End advance"
	},
	"ui.action.end_invasions": {
		"params": [],
		"zh-CN": "宣布不再登陆",
		"en": "End invasions"
	},
	"ui.action.enter_combat": {
		"params": [],
		"zh-CN": "进入战斗",
		"en": "Proceed to combat"
	},
	"ui.action.enter_move": {
		"params": [],
		"zh-CN": "进入移动",
		"en": "Proceed to movement"
	},
	"ui.action.event": {
		"params": [],
		"zh-CN": "事件",
		"en": "Event"
	},
	"ui.action.finish_placement": {
		"params": [],
		"zh-CN": "完成放置",
		"en": "Finish placement"
	},
	"ui.action.finish_refit": {
		"params": [],
		"zh-CN": "完成整补",
		"en": "Finish refit"
	},
	"ui.action.finish_retreat": {
		"params": [],
		"zh-CN": "完成撤退",
		"en": "Finish retreat"
	},
	"ui.action.med": {
		"params": [],
		"zh-CN": "地中海战区",
		"en": "Mediterranean theater"
	},
	"ui.action.move_marker": {
		"params": [],
		"zh-CN": "放置移动标记",
		"en": "Place move marker"
	},
	"ui.action.no": {
		"params": [],
		"zh-CN": "否",
		"en": "No"
	},
	"ui.action.nwe": {
		"params": [],
		"zh-CN": "西北欧战区",
		"en": "Northwest Europe theater"
	},
	"ui.action.ops": {
		"params": [],
		"zh-CN": "OPS",
		"en": "OPS"
	},
	"ui.action.pass": {
		"params": [],
		"zh-CN": "跳过",
		"en": "Pass"
	},
	"ui.action.place_partisan": {
		"params": [],
		"zh-CN": "放置游击队",
		"en": "Place partisan"
	},
	"ui.action.reject_rollback": {
		"params": [],
		"zh-CN": "拒绝回滚",
		"en": "Reject rollback"
	},
	"ui.action.reserve": {
		"params": [],
		"zh-CN": "进入盟军预备箱",
		"en": "Enter Allied Reserve Box"
	},
	"ui.action.resolve": {
		"params": [],
		"zh-CN": "结算",
		"en": "Resolve"
	},
	"ui.action.resolve_entrenchment": {
		"params": [],
		"zh-CN": "结算掘壕",
		"en": "Resolve entrenchment"
	},
	"ui.action.retreat": {
		"params": [],
		"zh-CN": "撤退",
		"en": "Retreat"
	},
	"ui.action.roll": {
		"params": [],
		"zh-CN": "掷骰",
		"en": "Roll"
	},
	"ui.action.rp": {
		"params": [],
		"zh-CN": "RP",
		"en": "RP"
	},
	"ui.action.select_all": {
		"params": [],
		"zh-CN": "全选",
		"en": "Select all"
	},
	"ui.action.single_beachhead": {
		"params": [],
		"zh-CN": "一个盟军滩头",
		"en": "One Allied beachhead"
	},
	"ui.action.skip_placement": {
		"params": [],
		"zh-CN": "不放置",
		"en": "Do not place"
	},
	"ui.action.sr": {
		"params": [],
		"zh-CN": "SR",
		"en": "SR"
	},
	"ui.action.stalin": {
		"params": [],
		"zh-CN": "调动斯大林",
		"en": "Move Stalin"
	},
	"ui.action.stop": {
		"params": [],
		"zh-CN": "停止移动",
		"en": "Stop moving"
	},
	"ui.action.undo": {
		"params": [],
		"zh-CN": "撤销",
		"en": "Undo"
	},
	"ui.action.yellow_ops": {
		"params": [],
		"zh-CN": "改作黄色事件 OPS",
		"en": "Use Yellow Event OPS"
	},
	"ui.action.yes": {
		"params": [],
		"zh-CN": "是",
		"en": "Yes"
	},
	"ui.activation": {
		"params": [],
		"zh-CN": "激活",
		"en": "Activation"
	},
	"ui.activation.cancel": {
		"params": [],
		"zh-CN": "取消激活",
		"en": "Cancel activation"
	},
	"ui.activation.combat": {
		"params": [],
		"zh-CN": "战斗激活",
		"en": "Combat activation"
	},
	"ui.activation.move": {
		"params": [],
		"zh-CN": "移动激活",
		"en": "Move activation"
	},
	"ui.allied": {
		"params": [],
		"zh-CN": "盟军",
		"en": "Allied"
	},
	"ui.axis": {
		"params": [],
		"zh-CN": "轴心国",
		"en": "Axis"
	},
	"ui.cancel": {
		"params": [],
		"zh-CN": "取消",
		"en": "Cancel"
	},
	"ui.cards": {
		"params": [],
		"zh-CN": "卡牌",
		"en": "Cards"
	},
	"ui.cards.choose": {
		"params": [],
		"zh-CN": "请选择卡牌",
		"en": "Choose a card"
	},
	"ui.cards.count": {
		"params": [
			"count"
		],
		"zh-CN": "{count}张牌",
		"en": "{count} cards"
	},
	"ui.cards.deck_count": {
		"params": [
			"side",
			"count"
		],
		"zh-CN": "{side}牌库：{count} 张",
		"en": "{side} deck: {count} cards"
	},
	"ui.cards.discard": {
		"params": [],
		"zh-CN": "弃牌堆",
		"en": "Discard pile"
	},
	"ui.cards.group_count": {
		"params": [
			"title",
			"count"
		],
		"zh-CN": "{title}（{count}）",
		"en": "{title} ({count})"
	},
	"ui.cards.my_discard": {
		"params": [],
		"zh-CN": "我的弃牌堆",
		"en": "My discard pile"
	},
	"ui.cards.none": {
		"params": [],
		"zh-CN": "无卡牌",
		"en": "No cards"
	},
	"ui.cards.removed": {
		"params": [],
		"zh-CN": "移出游戏卡牌",
		"en": "Removed cards"
	},
	"ui.cards.removed_side": {
		"params": [
			"side"
		],
		"zh-CN": "{side}移出游戏",
		"en": "{side} removed from play"
	},
	"ui.cards.strategy": {
		"params": [
			"side"
		],
		"zh-CN": "{side}战略牌",
		"en": "{side} strategy card"
	},
	"ui.close": {
		"params": [],
		"zh-CN": "关闭",
		"en": "Close"
	},
	"ui.collaboration": {
		"params": [],
		"zh-CN": "协作",
		"en": "Collaboration"
	},
	"ui.combat_cards": {
		"params": [],
		"zh-CN": "战斗牌",
		"en": "Combat cards"
	},
	"ui.deactivate": {
		"params": [],
		"zh-CN": "取消激活",
		"en": "Deactivate"
	},
	"ui.entrench": {
		"params": [],
		"zh-CN": "掘壕",
		"en": "Entrench"
	},
	"ui.event": {
		"params": [],
		"zh-CN": "事件",
		"en": "Event"
	},
	"ui.event_marker.allied_invasion_used": {
		"params": [],
		"zh-CN": "本回合已打出盟军登陆牌",
		"en": "Allied invasion card played this turn"
	},
	"ui.event_marker.barbarossa": {
		"params": [],
		"zh-CN": "巴巴罗萨",
		"en": "Barbarossa"
	},
	"ui.event_marker.fdr_declares_war": {
		"params": [],
		"zh-CN": "罗斯福宣战",
		"en": "FDR Declares War"
	},
	"ui.event_marker.hitler_declares_war": {
		"params": [],
		"zh-CN": "希特勒宣战",
		"en": "Hitler Declares War"
	},
	"ui.event_marker.lend_lease": {
		"params": [],
		"zh-CN": "租借法案",
		"en": "Lend-Lease"
	},
	"ui.event_marker.maquis": {
		"params": [],
		"zh-CN": "马基游击队",
		"en": "Maquis"
	},
	"ui.event_marker.overlord": {
		"params": [],
		"zh-CN": "霸王行动",
		"en": "Overlord"
	},
	"ui.event_marker.romania_defects": {
		"params": [],
		"zh-CN": "罗马尼亚倒戈",
		"en": "Romania Defects"
	},
	"ui.event_marker.round_up": {
		"params": [],
		"zh-CN": "围捕行动",
		"en": "Round-Up"
	},
	"ui.event_marker.sledgehammer": {
		"params": [],
		"zh-CN": "大锤行动",
		"en": "Sledgehammer"
	},
	"ui.event_marker.sorge": {
		"params": [],
		"zh-CN": "佐尔格",
		"en": "Sorge"
	},
	"ui.event_marker.speer": {
		"params": [],
		"zh-CN": "施佩尔",
		"en": "Speer"
	},
	"ui.event_marker.torch": {
		"params": [],
		"zh-CN": "火炬行动",
		"en": "Torch"
	},
	"ui.event_marker.us_buildup": {
		"params": [],
		"zh-CN": "美国扩军",
		"en": "US Build-Up"
	},
	"ui.event_marker.von_paulus_pause": {
		"params": [],
		"zh-CN": "保卢斯停顿",
		"en": "Von Paulus Pause"
	},
	"ui.events.ongoing": {
		"params": [],
		"zh-CN": "持续事件",
		"en": "Ongoing events"
	},
	"ui.hand": {
		"params": [],
		"zh-CN": "手牌",
		"en": "Hand"
	},
	"ui.log.die": {
		"params": [
			"value"
		],
		"zh-CN": "掷骰 {value}",
		"en": "Die roll {value}"
	},
	"ui.log.locate_card": {
		"params": [],
		"zh-CN": "定位卡牌",
		"en": "Locate card"
	},
	"ui.log.locate_piece": {
		"params": [],
		"zh-CN": "定位单位",
		"en": "Locate unit"
	},
	"ui.log.locate_space": {
		"params": [],
		"zh-CN": "在地图上定位",
		"en": "Locate on map"
	},
	"ui.marker.allied_beachhead": {
		"params": [],
		"zh-CN": "盟军滩头",
		"en": "Allied beachhead"
	},
	"ui.marker.control": {
		"params": [
			"side"
		],
		"zh-CN": "{side}控制",
		"en": "{side} control"
	},
	"ui.marker.hitler_stand_fast": {
		"params": [],
		"zh-CN": "希特勒坚守",
		"en": "Hitler Stand Fast"
	},
	"ui.marker.luftwaffe_supply": {
		"params": [],
		"zh-CN": "空军补给：本回合防御与损耗时为有限补给",
		"en": "Luftwaffe Supply: Limited Supply for defense and Attrition this turn"
	},
	"ui.marker.out_of_supply": {
		"params": [],
		"zh-CN": "断补",
		"en": "Out of Supply"
	},
	"ui.marker.shingle_beachhead": {
		"params": [],
		"zh-CN": "鹅卵石行动滩头",
		"en": "Operation Shingle beachhead"
	},
	"ui.marker.stalin": {
		"params": [],
		"zh-CN": "斯大林",
		"en": "Stalin"
	},
	"ui.marker.stalin_stand_fast": {
		"params": [],
		"zh-CN": "斯大林坚守",
		"en": "Stalin Stand Fast"
	},
	"ui.marker.trench": {
		"params": [
			"level"
		],
		"zh-CN": "{level}级堑壕",
		"en": "Level {level} trench"
	},
	"ui.menu": {
		"params": [],
		"zh-CN": "菜单",
		"en": "Menu"
	},
	"ui.move": {
		"params": [],
		"zh-CN": "移动",
		"en": "Move"
	},
	"ui.move_piece": {
		"params": [],
		"zh-CN": "移动单位",
		"en": "Move unit"
	},
	"ui.operations": {
		"params": [],
		"zh-CN": "行动点",
		"en": "Operations"
	},
	"ui.order.allied_mo": {
		"params": [],
		"zh-CN": "西方盟军强制攻势",
		"en": "Western Allied Mandated Offensive"
	},
	"ui.order.hitler_orders": {
		"params": [],
		"zh-CN": "希特勒命令",
		"en": "Hitler Orders"
	},
	"ui.order.none": {
		"params": [],
		"zh-CN": "无命令",
		"en": "No Order"
	},
	"ui.order.okw_mo": {
		"params": [],
		"zh-CN": "OKW强制攻势",
		"en": "OKW Mandated Offensive"
	},
	"ui.order.soviet_mo": {
		"params": [],
		"zh-CN": "苏军强制攻势",
		"en": "Soviet Mandated Offensive"
	},
	"ui.order.stalin_orders": {
		"params": [],
		"zh-CN": "斯大林命令",
		"en": "Stalin Orders"
	},
	"ui.piece.available": {
		"params": [],
		"zh-CN": "可用单位",
		"en": "Available units"
	},
	"ui.piece.eliminated": {
		"params": [],
		"zh-CN": "被消灭单位池",
		"en": "Eliminated Units Box"
	},
	"ui.piece.marker_status": {
		"params": [
			"name",
			"side",
			"location"
		],
		"zh-CN": "{name} · {side} · 游戏标记 · {location}",
		"en": "{name} · {side} · Game marker · {location}"
	},
	"ui.piece.off_map": {
		"params": [],
		"zh-CN": "场外",
		"en": "Off map"
	},
	"ui.piece.reduced": {
		"params": [],
		"zh-CN": "（减员）",
		"en": " (reduced)"
	},
	"ui.piece.reserve": {
		"params": [],
		"zh-CN": "预备兵力池",
		"en": "Reserve Box"
	},
	"ui.piece.space": {
		"params": [
			"id"
		],
		"zh-CN": "空间 {id}",
		"en": "Space {id}"
	},
	"ui.piece.status": {
		"params": [
			"name",
			"reduced",
			"side",
			"cf",
			"lf",
			"mf",
			"location"
		],
		"zh-CN": "{name}{reduced} · {side} · {cf}-{lf}-{mf} · {location}",
		"en": "{name}{reduced} · {side} · {cf}-{lf}-{mf} · {location}"
	},
	"ui.piece.turn_track": {
		"params": [],
		"zh-CN": "回合轨",
		"en": "Turn track"
	},
	"ui.reinforcement.board_label": {
		"params": [],
		"zh-CN": "巴巴罗萨到柏林印刷增援表",
		"en": "Barbarossa to Berlin reinforcement chart"
	},
	"ui.reinforcement.caption": {
		"params": [],
		"zh-CN": "印刷增援表：棋子入场后会从对应槽位移至地图；金色框表示当前可打出的增援事件。",
		"en": "Printed reinforcement chart. Counters leave their printed slots when they enter play; highlighted card boxes are currently playable events."
	},
	"ui.reinforcement.enter_reserve": {
		"params": [],
		"zh-CN": "进入预备区",
		"en": "Enter reserve"
	},
	"ui.replacements": {
		"params": [],
		"zh-CN": "补员",
		"en": "Replacements"
	},
	"ui.rollback.accept_text": {
		"params": [],
		"zh-CN": "对手请求回到之前的行动边界。请确认将撤销的位置和公开记录。",
		"en": "Your opponent requests a return to an earlier action boundary. Review the position and public record that will be undone."
	},
	"ui.rollback.checkpoint": {
		"params": [],
		"zh-CN": "回滚到：",
		"en": "Roll back to:"
	},
	"ui.rollback.defer": {
		"params": [],
		"zh-CN": "稍后决定",
		"en": "Decide later"
	},
	"ui.rollback.none": {
		"params": [],
		"zh-CN": "没有可用的回滚检查点。",
		"en": "No rollback checkpoints are available."
	},
	"ui.rollback.propose": {
		"params": [],
		"zh-CN": "提议回滚",
		"en": "Propose rollback"
	},
	"ui.rollback.propose_text": {
		"params": [],
		"zh-CN": "选择一个行动边界。对手接受后，游戏将回到该位置；已经产生的随机结果不会重新投掷。",
		"en": "Choose an action boundary. If your opponent accepts, the game will return to that point; random results already generated will not be rerolled."
	},
	"ui.rollback.reject": {
		"params": [],
		"zh-CN": "拒绝",
		"en": "Reject"
	},
	"ui.rollback.removed_log_count": {
		"params": [
			"count"
		],
		"zh-CN": "将撤销该检查点之后的{count}条公开记录。",
		"en": "{count} public log entries after this checkpoint will be undone."
	},
	"ui.rollback.review": {
		"params": [],
		"zh-CN": "审查回滚",
		"en": "Review rollback"
	},
	"ui.rollback.review_proposal": {
		"params": [],
		"zh-CN": "审查回滚提议",
		"en": "Review rollback proposal"
	},
	"ui.rp.axis": {
		"params": [],
		"zh-CN": "轴",
		"en": "Axis"
	},
	"ui.rp.br": {
		"params": [],
		"zh-CN": "英",
		"en": "BR"
	},
	"ui.rp.ge": {
		"params": [],
		"zh-CN": "德",
		"en": "GE"
	},
	"ui.rp.su": {
		"params": [],
		"zh-CN": "苏",
		"en": "SU"
	},
	"ui.rp.tu": {
		"params": [],
		"zh-CN": "土",
		"en": "TU"
	},
	"ui.rp.usa": {
		"params": [],
		"zh-CN": "美",
		"en": "US"
	},
	"ui.side.neutral": {
		"params": [],
		"zh-CN": "中立",
		"en": "Neutral"
	},
	"ui.space.beach": {
		"params": [],
		"zh-CN": "登陆滩头",
		"en": "Invasion beach"
	},
	"ui.space.capital": {
		"params": [],
		"zh-CN": "首都",
		"en": "Capital"
	},
	"ui.space.control": {
		"params": [
			"side"
		],
		"zh-CN": "控制：{side}",
		"en": "Control: {side}"
	},
	"ui.space.fort": {
		"params": [],
		"zh-CN": "要塞",
		"en": "Fort"
	},
	"ui.space.fort_destroyed": {
		"params": [],
		"zh-CN": "要塞已摧毁",
		"en": "Fort destroyed"
	},
	"ui.space.iron": {
		"params": [],
		"zh-CN": "铁矿",
		"en": "Iron"
	},
	"ui.space.oil": {
		"params": [],
		"zh-CN": "石油",
		"en": "Oil"
	},
	"ui.space.partisans": {
		"params": [],
		"zh-CN": "游击队",
		"en": "Partisans"
	},
	"ui.space.port": {
		"params": [],
		"zh-CN": "港口",
		"en": "Port"
	},
	"ui.space.sr": {
		"params": [],
		"zh-CN": "SR空间",
		"en": "SR space"
	},
	"ui.space.stand_fast": {
		"params": [],
		"zh-CN": "坚守",
		"en": "Stand Fast"
	},
	"ui.space.supply_source": {
		"params": [],
		"zh-CN": "印刷补给源",
		"en": "Printed supply source"
	},
	"ui.space.trench": {
		"params": [
			"level"
		],
		"zh-CN": "战壕 {level}",
		"en": "Trench {level}"
	},
	"ui.space.unit_count": {
		"params": [
			"count"
		],
		"zh-CN": "{count}个单位",
		"en": "{count} units"
	},
	"ui.space.urban": {
		"params": [],
		"zh-CN": "城市",
		"en": "Urban"
	},
	"ui.space.wehrkreis": {
		"params": [],
		"zh-CN": "军区",
		"en": "Wehrkreis"
	},
	"ui.stack": {
		"params": [],
		"zh-CN": "堆叠",
		"en": "Stacks"
	},
	"ui.stack.bevel": {
		"params": [],
		"zh-CN": "斜面",
		"en": "Beveled"
	},
	"ui.stack.flat": {
		"params": [],
		"zh-CN": "平面",
		"en": "Flat"
	},
	"ui.stack.mouse_focus": {
		"params": [],
		"zh-CN": "鼠标聚焦",
		"en": "Mouse focus"
	},
	"ui.strategic_redeployment": {
		"params": [],
		"zh-CN": "战略转移",
		"en": "Strategic Redeployment"
	},
	"ui.submit": {
		"params": [],
		"zh-CN": "提交",
		"en": "Submit"
	},
	"ui.supply.summary": {
		"params": [
			"side",
			"full",
			"limited",
			"oos"
		],
		"zh-CN": "{side}当前补给：完整 {full}，有限 {limited}，断补 {oos}",
		"en": "{side} supply: full {full}, limited {limited}, out of supply {oos}"
	},
	"ui.terrain.clear": {
		"params": [],
		"zh-CN": "平原",
		"en": "Clear"
	},
	"ui.terrain.desert": {
		"params": [],
		"zh-CN": "沙漠",
		"en": "Desert"
	},
	"ui.terrain.forest": {
		"params": [],
		"zh-CN": "森林",
		"en": "Forest"
	},
	"ui.terrain.mountain": {
		"params": [],
		"zh-CN": "山地",
		"en": "Mountain"
	},
	"ui.terrain.swamp": {
		"params": [],
		"zh-CN": "沼泽",
		"en": "Swamp"
	},
	"ui.toolbar.cards_allied": {
		"params": [],
		"zh-CN": "盟军牌组",
		"en": "Allied deck"
	},
	"ui.toolbar.cards_axis": {
		"params": [],
		"zh-CN": "轴心国牌组",
		"en": "Axis deck"
	},
	"ui.toolbar.charts": {
		"params": [],
		"zh-CN": "辅助图表",
		"en": "Charts"
	},
	"ui.toolbar.counters": {
		"params": [],
		"zh-CN": "棋子",
		"en": "Counters"
	},
	"ui.toolbar.cycle_counters": {
		"params": [],
		"zh-CN": "循环显示棋子与标记",
		"en": "Cycle counters and markers"
	},
	"ui.toolbar.discard": {
		"params": [],
		"zh-CN": "弃牌堆",
		"en": "Discard pile"
	},
	"ui.toolbar.pieces": {
		"params": [],
		"zh-CN": "算子图鉴",
		"en": "Counter reference"
	},
	"ui.toolbar.reinforcements": {
		"params": [],
		"zh-CN": "增援与兵力池",
		"en": "Reinforcements and force pools"
	},
	"ui.toolbar.removed": {
		"params": [],
		"zh-CN": "移出游戏牌",
		"en": "Removed cards"
	},
	"ui.toolbar.rules": {
		"params": [],
		"zh-CN": "规则书（2006 v1.3）",
		"en": "Rules (2006 v1.3)"
	},
	"ui.toolbar.supply_allied": {
		"params": [],
		"zh-CN": "盟军补给",
		"en": "Allied supply"
	},
	"ui.toolbar.supply_axis": {
		"params": [],
		"zh-CN": "轴心国补给",
		"en": "Axis supply"
	},
	"ui.toolbar.view": {
		"params": [],
		"zh-CN": "查看",
		"en": "View"
	},
	"ui.track.action": {
		"params": [
			"side",
			"round",
			"action"
		],
		"zh-CN": "{side}第{round}行动 · {action}",
		"en": "{side} Action {round} · {action}"
	},
	"ui.track.hand_limit": {
		"params": [
			"side",
			"count"
		],
		"zh-CN": "{side}手牌上限 {count}",
		"en": "{side} hand limit {count}"
	},
	"ui.track.industrial_evacuation": {
		"params": [
			"turn"
		],
		"zh-CN": "工业疏散：第{turn}回合起可打出坦克集团军",
		"en": "Industrial Evacuation: Tank Armies available from Turn {turn}"
	},
	"ui.track.orders": {
		"params": [
			"side",
			"order"
		],
		"zh-CN": "{side}命令 · {order}",
		"en": "{side} Orders · {order}"
	},
	"ui.track.rp": {
		"params": [
			"label",
			"value"
		],
		"zh-CN": "{label} {value}",
		"en": "{label} {value}"
	},
	"ui.track.rp_axis": {
		"params": [],
		"zh-CN": "轴心国RP",
		"en": "Axis RP"
	},
	"ui.track.rp_br": {
		"params": [],
		"zh-CN": "英军RP",
		"en": "British RP"
	},
	"ui.track.rp_ge": {
		"params": [],
		"zh-CN": "德军RP",
		"en": "German RP"
	},
	"ui.track.rp_su": {
		"params": [],
		"zh-CN": "苏军RP",
		"en": "Soviet RP"
	},
	"ui.track.rp_usa": {
		"params": [],
		"zh-CN": "美军RP",
		"en": "US RP"
	},
	"ui.track.turn": {
		"params": [
			"turn"
		],
		"zh-CN": "第{turn}回合",
		"en": "Turn {turn}"
	},
	"ui.track.vp_ones": {
		"params": [
			"value"
		],
		"zh-CN": "VP个位 {value}",
		"en": "VP ones digit {value}"
	},
	"ui.track.vp_tens": {
		"params": [
			"value"
		],
		"zh-CN": "VP十位 {value}",
		"en": "VP tens digit {value}"
	},
	"ui.warning.flag": {
		"params": [],
		"zh-CN": "标记补给警告",
		"en": "Flag supply warnings"
	},
	"ui.warning.flag_count": {
		"params": [
			"count"
		],
		"zh-CN": "标记补给警告 ({count})",
		"en": "Flag supply warnings ({count})"
	}
}
	for (const message of Object.values(source)) {
		Object.freeze(message.params)
		Object.freeze(message)
	}
	return Object.freeze(source)
})
