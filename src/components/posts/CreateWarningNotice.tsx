import React from 'react';
import { CreateNoticeForm } from './CreateNoticeForm';
import type { CommunityNotice } from '../../types';

interface Props {
  onBack?: () => void;
  postToEdit?: CommunityNotice;
}

export const CreateWarningNotice: React.FC<Props> = ({ onBack, postToEdit }) => (
  <CreateNoticeForm postSubtype="warning" onBack={onBack} postToEdit={postToEdit} />
);

export default CreateWarningNotice;
