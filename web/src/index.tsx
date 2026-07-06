/*
Copyright 2025 Adobe. All rights reserved.
Licensed under the Apache License, Version 2.0
*/

import { configureWeb } from '@adobedjangir/commerce-admin-management/web'
import SnapshotHistory from './SnapshotHistory'

export default function registerSnapshots () {
  configureWeb({
    actionKeys: {
      systemConfigSnapshotCreate:  'Snapshots/system-config-snapshot-create',
      systemConfigSnapshotList:    'Snapshots/system-config-snapshot-list',
      systemConfigSnapshotRestore: 'Snapshots/system-config-snapshot-restore',
      systemConfigSnapshotDelete:  'Snapshots/system-config-snapshot-delete'
    },
    extraNav: [{
      id: 'snapshots',
      path: '/snapshots',
      label: 'Snapshots',
      icon: 'Box',
      parentId: 'system'
    }],
    extraPages: { snapshots: SnapshotHistory }
  })
}

export { default as SnapshotHistory } from './SnapshotHistory'
