import React from 'react';
import { CreateNoticeForm } from './CreateNoticeForm';
import type { CommunityNotice } from '../../types';

interface Props {
  onBack?: () => void;
  postToEdit?: CommunityNotice;
}

export const CreateInfoNotice: React.FC<Props> = ({ onBack, postToEdit }) => (
  <CreateNoticeForm postSubtype="information" onBack={onBack} postToEdit={postToEdit} />
);

export default CreateInfoNotice;
