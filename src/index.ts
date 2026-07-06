/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

// Snapshots add-on has no server-side hooks back into core today — the
// snapshot actions are self-contained. This file is the package's entry
// point for completeness; consumers don't normally need to import from it.

const SNAPSHOT_COLLECTION = 'system_config_snapshots'

export { SNAPSHOT_COLLECTION }
