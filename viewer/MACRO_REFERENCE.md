# 📝 Macro Quick Reference Guide

## What are Macros?

Macros are text shortcuts that automatically expand into full sentences or phrases. They save radiologists significant time by reducing repetitive typing.

## How to Use Macros

1. Type the macro trigger (starts with a dot `.`)
2. Press **Space**
3. The text automatically expands

Example:
```
Type: .normal 
Result: No acute abnormalities identified.
```

## Default Macros

### General Macros

| Trigger | Expansion | Category |
|---------|-----------|----------|
| `.normal` | No acute abnormalities identified. | General |
| `.bones` | Osseous structures appear intact without acute fracture or dislocation. | General |

### Chest Imaging Macros

| Trigger | Expansion | Category |
|---------|-----------|----------|
| `.lungs` | Lungs are clear bilaterally without consolidation, effusion, or pneumothorax. | Chest |
| `.heart` | Heart size is normal. No pericardial effusion. | Chest |

### Impression Macros

| Trigger | Expansion | Category |
|---------|-----------|----------|
| `.impression` | No acute cardiopulmonary process identified. | Impression |

## Creating Custom Macros (Future Feature)

In future versions, you'll be able to:
- Create your own custom macros
- Share macros with colleagues
- Import/export macro libraries
- Organize macros by specialty

## Tips for Efficient Use

1. **Learn the common ones**: Start with `.normal`, `.lungs`, `.heart`
2. **Use in any text field**: Works in all report sections
3. **Combine with typing**: Use macros for common phrases, type custom details
4. **Check the helper**: Look at the blue info box in Sections tab for reminders

## Example Workflow

```
Clinical Information:
Type: "Patient presents with chest pain. "
Type: .normal
Result: "Patient presents with chest pain. No acute abnormalities identified."

Findings:
Type: .lungs
Result: "Lungs are clear bilaterally without consolidation, effusion, or pneumothorax."
Type: " "
Type: .heart
Result: "Lungs are clear bilaterally without consolidation, effusion, or pneumothorax. Heart size is normal. No pericardial effusion."

Impression:
Type: .impression
Result: "No acute cardiopulmonary process identified."
```

## Macro Categories (Expandable)

### 🫁 Chest/Pulmonary
- `.lungs` - Normal lungs
- `.heart` - Normal heart
- `.impression` - Normal chest impression

### 🦴 Musculoskeletal
- `.bones` - Normal bones

### 🧠 Neuro (Coming Soon)
- `.brain` - Normal brain
- `.spine` - Normal spine

### 🫀 Cardiac (Coming Soon)
- `.coronary` - Normal coronary arteries
- `.valves` - Normal cardiac valves

### 🫘 Abdominal (Coming Soon)
- `.liver` - Normal liver
- `.kidneys` - Normal kidneys

## Keyboard Shortcuts (Coming Soon)

- `Ctrl+M` - Show macro list
- `Ctrl+Shift+M` - Create new macro
- `Tab` - Cycle through macro suggestions

---

**Pro Tip**: The more you use macros, the faster your reporting becomes. Most radiologists save 30-50% of their typing time with macros!
