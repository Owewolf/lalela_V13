import React from 'react';
import { CreateNoticeForm } from './CreateNoticeForm';
import type { CommunityNotice } from '../../types';

interface Props {
  onBack?: () => void;
  postToEdit?: CommunityNotice;
}

export const CreateGeneralNotice: React.FC<Props> = ({ onBack, postToEdit }) => (
  <CreateNoticeForm postSubtype="normal" onBack={onBack} postToEdit={postToEdit} />
);

export default CreateGeneralNotice;
