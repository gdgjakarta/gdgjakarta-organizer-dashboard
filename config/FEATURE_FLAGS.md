# Firebase Remote Config Feature Flags Guide

This document describes how the dynamic feature flag system works and how to configure it in the **Firebase Remote Config** console.

---

## 1. What This Config Is For

The **`cfg_feature_flags`** parameter enables organizers and developers to dynamically control dashboard navigation without editing code or redeploying the app:

* **Hide / Show Navigation Menus**: Temporarily hide incomplete or maintenance-bound features.
* **Control Badges**:
  * **`"new"`**: Green badge highlighting newly launched features.
  * **`"preview"`**: Amber badge indicating features currently **under development** (displays tooltip *"Under development"* on hover).
  * **`"soon"`**: Muted badge indicating coming-soon features.
  * **`null`**: Explicitly removes a badge once a feature is no longer new.
* **Enable / Disable Links**: Mark a menu as disabled (`aria-disabled`) without modifying codebase routes.
* **Opt-in & Zero-Drift**: Unlisted menus remain visible and keep their existing defaults. You only specify the menus you want to alter.

---

## 2. Firebase Remote Config Parameter Setup

When creating or editing the parameter in the **[Firebase Console](https://console.firebase.google.com/)**:

| Field | Value |
|---|---|
| **Parameter Name** | `cfg_feature_flags` |
| **Data Type** | `JSON` |
| **Description** | `Dynamic feature flags controlling menu visibility, badges ('new', 'soon', 'preview'), and disabled states.` |
| **Default Value** | `{}` |

---

## 3. JSON Format & Schema

The value is a JSON object where each key matches a menu item by **Menu ID**, **Menu Title**, or **URL**:

```json
{
  "Members": {
    "badge": null
  },
  "Email Manager": {
    "badge": "preview"
  },
  "Others": {
    "visible": false
  }
}
```

### Supported Properties per Item:

| Property | Type | Description |
|---|---|---|
| **`visible`** | `boolean` | `true` to keep visible; `false` to hide from sidebar navigation. If omitted, defaults to `true`. |
| **`badge`** | `string \| null` | Set to `"new"`, `"preview"`, `"soon"`, or custom text. Set to `null`, `""`, or `"none"` to **remove** the badge. If omitted, retains code default. |
| **`disabled`** | `boolean` | `true` to make the menu item unclickable. If omitted, retains code default. |

---

## 4. Badge Reference

| Value | Appearance | Meaning |
|---|---|---|
| **`"new"`** | Green pill (`border-green-600 text-green-600`) | Feature is freshly launched and ready for use. |
| **`"preview"`** *(or `"under development"`, `"wip"`)* | Amber pill (`border-amber-600 text-amber-600`) | Feature is **under development** / in progress. Shows hover tooltip: *"Under development"*. |
| **`"soon"`** | Muted pill (`border-muted-foreground text-muted-foreground`) | Feature is planned for a future release. |
| **`null`** *(or `""`, `"none"`)* | No badge | Badge is completely removed. |

---

## 5. Key Matching Strategy

You don't need to look up internal code IDs. The system supports multiple matching formats:

1. **Menu Name / Title** (User-friendly):
   * `"Members"`
   * `"Email Manager"`
   * `"Partnership & Sponsorship"`
2. **Menu ID** (Technical ID):
   * `"members"`
   * `"email-manager"`
   * `"partnership"`
3. **Case-Insensitive & Delimiter-Agnostic**:
   * `"email manager"`, `"Email-Manager"`, and `"email-manager"` all resolve to the same menu item.
4. **URL Path**:
   * `"/dashboard/members"`

---

## 6. Real-World Use Case Recipes

### Recipe A: Remove the "New" Badge from Members
When the launch period for Members ends, publish:
```json
{
  "Members": {
    "badge": null
  }
}
```

### Recipe B: Mark a Menu as "Under Development"
To mark Email Manager as preview while organizing the blast composer:
```json
{
  "Email Manager": {
    "badge": "preview"
  }
}
```

### Recipe C: Hide a Page Temporarily
To hide the "Others" or "Coming Soon" section:
```json
{
  "Others": {
    "visible": false
  }
}
```
*(Or use shorthand: `"{ \"Others\": false }"`)*

### Recipe D: Launch a Previously "Coming Soon" Feature
When a feature previously tagged `"soon"` is ready:
```json
{
  "Others": {
    "visible": true,
    "badge": "new",
    "disabled": false
  }
}
```

---

## 7. Real-Time Live Updates

The dashboard integrates Firebase Remote Config's real-time listener (`onConfigUpdate`). 

Whenever you click **"Publish changes"** in the Firebase Console:
1. Open dashboard tabs automatically receive the configuration push in the background.
2. The sidebar re-renders immediately with the new badges or visibility.
3. No hard refresh (`F5`) or redeployment is required.
